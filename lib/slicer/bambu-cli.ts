import { execSync } from "child_process";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import os from "os";

export interface PlateInfo {
  index: number;
  estimatedSeconds: number;
  totalGrams: number;
  thumbnailEntry: string | null;
  filaments: {
    slotId: string;
    colorHex: string;
    material: string;
    grams: number;
    meters: number;
  }[];
}

export interface SliceCacheData {
  plates: PlateInfo[];
  totalGrams: number;
  estimatedSeconds: number;
  filaments: { colorHex: string; material: string; grams: number }[];
  slicedAt: string;
}

export function parseSliceInfoXml(xml: string): PlateInfo[] {
  const plates: PlateInfo[] = [];
  const plateBlocks = xml.match(/<plate>([\s\S]*?)<\/plate>/g) ?? [];

  for (const block of plateBlocks) {
    const meta = (key: string) => {
      const m = block.match(new RegExp(`key="${key}"\\s+value="([^"]+)"`));
      return m ? m[1] : null;
    };

    const index = parseInt(meta("index") ?? "0");
    const prediction = parseFloat(meta("prediction") ?? "0");
    const weight = parseFloat(meta("weight") ?? "0");

    const filaments: PlateInfo["filaments"] = [];
    const filRe = /<filament\s([^/]+)\/>/g;
    let fm: RegExpExecArray | null;
    while ((fm = filRe.exec(block)) !== null) {
      const attrs = fm[1];
      const a = (k: string) => { const m = attrs.match(new RegExp(`${k}="([^"]+)"`)); return m ? m[1] : ""; };
      filaments.push({
        slotId: a("id"),
        colorHex: a("color") || "#000000",
        material: a("type") || "PLA",
        grams: parseFloat(a("used_g") || "0"),
        meters: parseFloat(a("used_m") || "0"),
      });
    }

    plates.push({ index, estimatedSeconds: prediction, totalGrams: weight, thumbnailEntry: `Metadata/plate_${index}.png`, filaments });
  }

  return plates;
}

export function sliceFile(inputPath: string): SliceCacheData | null {
  const bambuStudioPath = process.env.BAMBU_STUDIO_PATH;
  if (!bambuStudioPath || !fs.existsSync(bambuStudioPath)) {
    console.log("[BambuCLI] BAMBU_STUDIO_PATH not set or not found");
    return null;
  }

  const tmpOutput = path.join(os.tmpdir(), `3dhub-slice-${Date.now()}.3mf`);

  try {
    execSync(`"${bambuStudioPath}" --slice 0 --export-3mf "${tmpOutput}" "${inputPath}"`, {
      timeout: 180_000,
      windowsHide: true,
    });

    if (!fs.existsSync(tmpOutput)) {
      console.log("[BambuCLI] No output file created");
      return null;
    }

    const zip = new AdmZip(tmpOutput);
    const sliceEntry = zip.getEntry("Metadata/slice_info.config");
    if (!sliceEntry) return null;

    const xml = sliceEntry.getData().toString("utf8");
    if (!xml.includes("<plate>")) return null;

    const plates = parseSliceInfoXml(xml);
    if (!plates.length) return null;

    const totalSeconds = plates.reduce((s, p) => s + p.estimatedSeconds, 0);
    const totalGrams = plates.reduce((s, p) => s + p.totalGrams, 0);

    const filamentMap = new Map<string, { material: string; grams: number }>();
    for (const plate of plates) {
      for (const f of plate.filaments) {
        const existing = filamentMap.get(f.colorHex);
        filamentMap.set(f.colorHex, { material: f.material, grams: (existing?.grams ?? 0) + f.grams });
      }
    }

    return {
      plates,
      totalGrams,
      estimatedSeconds: totalSeconds,
      filaments: Array.from(filamentMap.entries()).map(([colorHex, { material, grams }]) => ({ colorHex, material, grams })),
      slicedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[BambuCLI] Slice error:", err);
    return null;
  } finally {
    try { fs.unlinkSync(tmpOutput); } catch { /* ignore */ }
  }
}

export function getCachePath(folder: string, fileName: string): string {
  return path.join(folder, ".3dhub-cache", `${fileName}.json`);
}

export function readCache(folder: string, fileName: string, filePath: string): SliceCacheData | null {
  try {
    const cachePath = getCachePath(folder, fileName);
    if (!fs.existsSync(cachePath)) return null;
    const cacheStat = fs.statSync(cachePath);
    const fileStat = fs.statSync(filePath);
    if (fileStat.mtimeMs > cacheStat.mtimeMs) return null;
    return JSON.parse(fs.readFileSync(cachePath, "utf8")) as SliceCacheData;
  } catch {
    return null;
  }
}

export function writeCache(folder: string, fileName: string, data: SliceCacheData): void {
  const cacheDir = path.join(folder, ".3dhub-cache");
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, `${fileName}.json`), JSON.stringify(data), "utf8");
}
