import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { readCache, writeCache, parseSliceInfoXml, type PlateInfo, type SliceCacheData } from "@/lib/slicer/bambu-cli";

export type { PlateInfo };

export interface FilamentUsage {
  colorHex: string;
  grams: number;
}

export interface ModelMetadata {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  modifiedAt: Date;
  thumbnailEntry: string | null;
  filaments: { colorHex: string; material: string; grams: number }[];
  totalGrams: number;
  estimatedSeconds: number | null;
  layerHeight: number | null;
  plates: PlateInfo[];
  dataSource: "gcode" | "geometry" | "none" | "slice_info";
}

export function readAllModels(folder: string): ModelMetadata[] {
  try {
    const files = fs
      .readdirSync(folder)
      .filter((f) => f.toLowerCase().endsWith(".3mf"))
      .map((f) => {
        const full = path.join(folder, f);
        const stat = fs.statSync(full);
        return { fileName: f, filePath: full, sizeBytes: stat.size, modifiedAt: stat.mtime };
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    return files.map((f) => {
      try {
        return extractMetadata(f);
      } catch {
        return {
          ...f,
          thumbnailEntry: null,
          filaments: [],
          totalGrams: 0,
          estimatedSeconds: null,
          layerHeight: null,
          plates: [],
          dataSource: "none" as const,
        };
      }
    });
  } catch {
    return [];
  }
}

function extractMetadata(f: { fileName: string; filePath: string; sizeBytes: number; modifiedAt: Date }): ModelMetadata {
  const folder = path.dirname(f.filePath);

  // Check slice cache first (populated by CLI or by reading slice_info.config)
  const cached = readCache(folder, f.fileName, f.filePath);
  if (cached) {
    return {
      ...f,
      thumbnailEntry: cached.plates[0]?.thumbnailEntry ?? null,
      filaments: cached.filaments,
      totalGrams: cached.totalGrams,
      estimatedSeconds: cached.estimatedSeconds,
      layerHeight: null,
      plates: cached.plates,
      dataSource: "slice_info" as const,
    };
  }

  const zip = new AdmZip(f.filePath);
  const entries = zip.getEntries();

  // Thumbnail — try common Bambu Studio paths
  const thumbnailEntry =
    entries.find((e) => /plate_\d+\.png$/i.test(e.entryName) && !e.isDirectory)?.entryName ??
    entries.find((e) => /thumbnail.*\.png$/i.test(e.entryName) && !e.isDirectory)?.entryName ??
    entries.find((e) => e.entryName.endsWith(".png") && !e.isDirectory)?.entryName ??
    null;

  // Try slice_info.config (Bambu Studio v01.10.x saves slice data on project save)
  const sliceInfoEntry = entries.find((e) => e.entryName === "Metadata/slice_info.config" && !e.isDirectory);
  if (sliceInfoEntry) {
    const xml = sliceInfoEntry.getData().toString("utf8");
    if (xml.includes("<plate>")) {
      const plates = parseSliceInfoXml(xml);
      if (plates.length > 0) {
        const totalGrams = plates.reduce((s, p) => s + p.totalGrams, 0);
        const estimatedSeconds = plates.reduce((s, p) => s + p.estimatedSeconds, 0);
        const filamentMap = new Map<string, { material: string; grams: number }>();
        for (const plate of plates) {
          for (const fil of plate.filaments) {
            const existing = filamentMap.get(fil.colorHex);
            filamentMap.set(fil.colorHex, { material: fil.material, grams: (existing?.grams ?? 0) + fil.grams });
          }
        }
        const filaments = Array.from(filamentMap.entries()).map(([colorHex, { material, grams }]) => ({ colorHex, material, grams }));
        const cacheData: SliceCacheData = { plates, totalGrams, estimatedSeconds, filaments, slicedAt: new Date().toISOString() };
        try { writeCache(folder, f.fileName, cacheData); } catch { /* non-critical */ }
        return { ...f, thumbnailEntry: plates[0]?.thumbnailEntry ?? thumbnailEntry, filaments, totalGrams, estimatedSeconds, layerHeight: null, plates, dataSource: "slice_info" as const };
      }
    }
  }

  // Gcode — only embedded gcode is reliable (external files cover a single plate only)
  const gcodeGzEntries = entries.filter((e) => e.entryName.endsWith(".gcode.gz") && !e.isDirectory);
  const gcodeEntries   = entries.filter((e) => e.entryName.endsWith(".gcode")    && !e.isDirectory);
  const gcodeGzEntry   = gcodeGzEntries[0];
  const gcodeEntry     = gcodeEntries[0];

  if (!gcodeGzEntry && !gcodeEntry) {
    // No embedded gcode — return config filaments only; geometry is estimated on-demand via /api/models/geometry
    const filaments = extractFilamentsFromConfig(zip, entries);
    return { ...f, thumbnailEntry, filaments, totalGrams: 0, estimatedSeconds: null, layerHeight: null, plates: [], dataSource: "none" as const };
  }

  // 64KB covers both the HEADER_BLOCK and the CONFIG_BLOCK where Bambu Studio stores filament data
  const HEADER_SIZE = 65536;

  // Collect headers from embedded gcode only
  const headers: string[] = [];
  if (gcodeGzEntry) {
    headers.push(zlib.gunzipSync(gcodeGzEntry.getData()).slice(0, HEADER_SIZE).toString("utf8"));
  } else if (gcodeEntry) {
    headers.push(gcodeEntry.getData().slice(0, HEADER_SIZE).toString("utf8"));
  }

  // Parse and aggregate data across all plates
  const filamentMap = new Map<string, { grams: number; material: string }>();
  let totalEstimatedSeconds = 0;
  let layerHeight: number | null = null;

  for (const header of headers) {
    const colorMatch = header.match(/;\s*filament_colour\s*=\s*([^\n\r]+)/);
    const gramsMatch =
      header.match(/;\s*filament used \[g\]\s*=\s*([^\n\r]+)/) ??
      header.match(/;\s*total filament weight \[g\]\s*:\s*([^\n\r]+)/);
    const typeMatch  = header.match(/;\s*filament_type\s*=\s*([^\n\r]+)/);
    const timeMatch  =
      header.match(/;\s*model printing time\s*:\s*([^;\n\r]+)/i) ??
      header.match(/;\s*(?:estimated printing time|print_time)\s*[=:]\s*([^\n\r]+)/i);
    const lhMatch    = header.match(/;\s*layer_height\s*=\s*([\d.]+)/);

    if (lhMatch && !layerHeight) layerHeight = parseFloat(lhMatch[1]);

    if (timeMatch) {
      const raw = timeMatch[1].trim();
      if (/^\d+$/.test(raw)) {
        totalEstimatedSeconds += parseInt(raw);
      } else {
        let secs = 0;
        const h = raw.match(/(\d+)h/);
        const m = raw.match(/(\d+)m/);
        const s = raw.match(/(\d+)s/);
        if (h) secs += parseInt(h[1]) * 3600;
        if (m) secs += parseInt(m[1]) * 60;
        if (s) secs += parseInt(s[1]);
        totalEstimatedSeconds += secs;
      }
    }

    if (colorMatch) {
      const colors    = colorMatch[1].trim().split(";").map((c) => normalizeHex(c.trim()));
      const gramsRaw  = gramsMatch ? gramsMatch[1].trim().split(";").map((g) => parseFloat(g)) : [];
      const materials = typeMatch  ? typeMatch[1].trim().split(";").map((t) => t.trim()) : [];
      const grams = (gramsRaw.length === 1 && colors.length > 1)
        ? colors.map(() => gramsRaw[0] / colors.length)
        : gramsRaw;

      colors.forEach((colorHex, i) => {
        const g = grams[i] ?? 0;
        const existing = filamentMap.get(colorHex);
        filamentMap.set(colorHex, {
          grams: (existing?.grams ?? 0) + g,
          material: existing?.material ?? materials[i] ?? "PLA",
        });
      });
    }
  }

  const filaments = Array.from(filamentMap.entries())
    .map(([colorHex, { grams, material }]) => ({ colorHex, material, grams }))
    .filter((f) => f.grams > 0 || filamentMap.size === 1);

  // If no gcode had color data, fall back to config
  if (filaments.length === 0) {
    const cfgFilaments = extractFilamentsFromConfig(zip, entries);
    cfgFilaments.forEach((cf) => {
      if (!filamentMap.has(cf.colorHex)) filamentMap.set(cf.colorHex, { grams: 0, material: cf.material });
    });
    filaments.push(...Array.from(filamentMap.entries()).map(([colorHex, { grams, material }]) => ({ colorHex, material, grams })));
  }

  const totalGrams = filaments.reduce((s, fi) => s + fi.grams, 0);
  const estimatedSeconds = totalEstimatedSeconds > 0 ? totalEstimatedSeconds : null;

  return { ...f, thumbnailEntry, filaments, totalGrams, estimatedSeconds, layerHeight, plates: [], dataSource: "gcode" as const };
}


/**
 * Parses a Bambu Studio gcode string for per-filament usage.
 * Looks for lines like:
 *   ; filament_colour = #FF0000;#FFFFFF
 *   ; filament used [g] = 12.34;56.78
 */
export function parseGcode(gcode: string): FilamentUsage[] | null {
  const colorMatch = gcode.match(/;\s*filament_colour\s*=\s*([^\n]+)/);
  const gramsMatch =
    gcode.match(/;\s*filament used \[g\]\s*=\s*([^\n]+)/) ??
    gcode.match(/;\s*total filament weight \[g\]\s*:\s*([^\n]+)/);

  if (!colorMatch || !gramsMatch) return null;

  const colors = colorMatch[1].trim().split(";").map((c) => c.trim());
  const gramsRaw = gramsMatch[1].trim().split(";").map((g) => parseFloat(g.trim()));

  // Bambu Studio's "total filament weight" is a single total — distribute across colors
  if (gramsRaw.length === 1 && colors.length > 1) {
    const total = gramsRaw[0];
    return colors.map((hex) => ({ colorHex: normalizeHex(hex), grams: total / colors.length })).filter((f) => f.grams > 0);
  }

  if (colors.length !== gramsRaw.length) return null;

  return colors
    .map((hex, i) => ({ colorHex: normalizeHex(hex), grams: gramsRaw[i] }))
    .filter((f) => f.grams > 0);
}

// Parses 3MF geometry to compute volume (mm³), surface area (mm²) and max Z height (mm).
// Respects the assembly structure — objects appearing multiple times are counted accordingly.
export function parse3mfGeometry(zip: AdmZip): { volumeMm3: number; surfaceAreaMm2: number; maxZMm: number } | null {
  try {
    // Build instance count map: how many times each object file path is used in the assembly
    const instanceCounts = new Map<string, number>();
    const mainModel = zip.getEntry("3D/3dmodel.model");
    if (mainModel) {
      const mainXml = mainModel.getData().toString("utf8");
      // Count component references: <component p:path="/3D/Objects/object_X.model" .../>
      const compRe = /p:path="([^"]+\.model)"/g;
      let cm: RegExpExecArray | null;
      while ((cm = compRe.exec(mainXml)) !== null) {
        const p = cm[1].replace(/^\//, ""); // strip leading slash
        instanceCounts.set(p, (instanceCounts.get(p) ?? 0) + 1);
      }
    }

    const objectEntries = zip.getEntries().filter(
      (e) => e.entryName.startsWith("3D/Objects/") && e.entryName.endsWith(".model") && !e.isDirectory
    );
    if (objectEntries.length === 0) return null;

    let totalVolume = 0;
    let totalSurface = 0;
    let maxZ = 0;

    for (const entry of objectEntries) {
      const instances = instanceCounts.get(entry.entryName) ?? 1;
      const xml = entry.getData().toString("utf8");

      const xs: number[] = [], ys: number[] = [], zs: number[] = [];
      const vRe = /x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = vRe.exec(xml)) !== null) {
        xs.push(parseFloat(m[1]));
        ys.push(parseFloat(m[2]));
        const z = parseFloat(m[3]);
        zs.push(z);
        if (z > maxZ) maxZ = z;
      }

      let objVolume = 0, objSurface = 0;
      const tRe = /v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g;
      while ((m = tRe.exec(xml)) !== null) {
        const i1 = +m[1], i2 = +m[2], i3 = +m[3];
        const x1 = xs[i1], y1 = ys[i1], z1 = zs[i1];
        const x2 = xs[i2], y2 = ys[i2], z2 = zs[i2];
        const x3 = xs[i3], y3 = ys[i3], z3 = zs[i3];

        objVolume += x1 * (y2 * z3 - y3 * z2) + y1 * (z2 * x3 - z3 * x2) + z1 * (x2 * y3 - x3 * y2);

        const ex1 = x2 - x1, ey1 = y2 - y1, ez1 = z2 - z1;
        const ex2 = x3 - x1, ey2 = y3 - y1, ez2 = z3 - z1;
        const cx = ey1 * ez2 - ez1 * ey2;
        const cy = ez1 * ex2 - ex1 * ez2;
        const cz = ex1 * ey2 - ey1 * ex2;
        objSurface += Math.sqrt(cx * cx + cy * cy + cz * cz) * 0.5;
      }

      totalVolume  += objVolume  * instances;
      totalSurface += objSurface * instances;
    }

    return {
      volumeMm3: Math.abs(totalVolume) / 6,
      surfaceAreaMm2: totalSurface,
      maxZMm: maxZ,
    };
  } catch {
    return null;
  }
}

// Estimates grams and print time from pure geometry — no gcode needed.
// Uses same approach as online 3MF analyzers: volume × density × infill factor.
export function estimateFromGeometry(
  geo: { volumeMm3: number; surfaceAreaMm2: number; maxZMm: number },
  opts: {
    densityGCm3?: number;  // material density (PLA=1.24)
    infillPct?: number;    // 0-1, default 0.20
    nozzleDiam?: number;   // mm, default 0.4
    flowRateMm3s?: number; // mm³/s, Bambu A1 Mini ~21
    layerHeightMm?: number;
    timeOverheadFactor?: number; // accounts for travel, acceleration, etc.
  } = {}
): { grams: number; estimatedSeconds: number } {
  const {
    densityGCm3 = 1.24,
    infillPct = 0.20,
    nozzleDiam = 0.4,
    flowRateMm3s = 21,
    layerHeightMm = 0.2,
    timeOverheadFactor = 2.5,
  } = opts;

  const densityGMm3 = densityGCm3 / 1000;
  const wallMm = 2 * nozzleDiam; // 2 perimeters ≈ standard

  const shellVolume   = geo.surfaceAreaMm2 * wallMm;
  const interior      = Math.max(0, geo.volumeMm3 - shellVolume);
  const infillVolume  = interior * infillPct;
  const plasticVolume = shellVolume + infillVolume;

  // 15% extra for brim, purge, supports
  const grams = plasticVolume * densityGMm3 * 1.15;

  const numLayers = Math.ceil(geo.maxZMm / layerHeightMm);
  const extrusionSec = plasticVolume / flowRateMm3s;
  const timeSec = Math.max(extrusionSec * timeOverheadFactor, numLayers * 8);

  return { grams, estimatedSeconds: Math.round(timeSec) };
}

// Reads filament color + type from Bambu Studio project_settings.config (no gcode required)
export function extractFilamentsFromConfig(
  zip: AdmZip,
  entries: AdmZip.IZipEntry[]
): { colorHex: string; material: string; grams: number }[] {
  try {
    const cfgEntry = entries.find((e) => e.entryName === "Metadata/project_settings.config" && !e.isDirectory);
    if (!cfgEntry) return [];
    const cfg = JSON.parse(cfgEntry.getData().toString("utf8"));
    const colors: string[] = Array.isArray(cfg.filament_colour) ? cfg.filament_colour : [];
    const types: string[]  = Array.isArray(cfg.filament_type)   ? cfg.filament_type   : [];
    if (colors.length === 0) return [];
    return colors.map((c, i) => ({
      colorHex: normalizeHex(c),
      material: types[i] ?? "PLA",
      grams: 0,
    }));
  } catch {
    return [];
  }
}

function normalizeHex(hex: string): string {
  // Bambu sometimes uses 8-char hex (AARRGGBB) — strip alpha
  const clean = hex.replace(/^#/, "");
  if (clean.length === 8) return `#${clean.slice(2)}`;
  return `#${clean}`;
}

/**
 * Fallback: reads the most recently modified .3mf within `windowHours` hours.
 * Only returns data if there's exactly one candidate (avoids ambiguity).
 */
export function readFilamentUsageFrom3mfRecent(
  folder: string,
  windowHours: number
): FilamentUsage[] | null {
  try {
    const cutoff = Date.now() - windowHours * 3600 * 1000;
    const candidates = fs
      .readdirSync(folder)
      .filter((f) => f.toLowerCase().endsWith(".3mf"))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(folder, f)).mtimeMs }))
      .filter((f) => f.mtime >= cutoff)
      .sort((a, b) => b.mtime - a.mtime);

    if (candidates.length === 0) {
      console.log(`[GCode] No .3mf modified in last ${windowHours}h`);
      return null;
    }
    if (candidates.length > 1) {
      console.log(`[GCode] ${candidates.length} recent .3mf files — ambiguous, skipping fallback`);
      return null;
    }

    console.log(`[GCode] Recent fallback: ${candidates[0].name}`);
    return extractFromFile(path.join(folder, candidates[0].name));
  } catch {
    return null;
  }
}

/**
 * Finds and reads the correct .3mf file matching the print job name.
 *
 * Match strategy (in order):
 *   1. Exact: strip extension from mqttGcodeFile → look for <name>.3mf
 *   2. Internal: open each .3mf and check if its gcode entry name matches
 *   3. No fallback — returns null so the caller can decide
 */
export function readFilamentUsageFrom3mf(
  folder: string,
  mqttGcodeFile: string
): FilamentUsage[] | null {
  try {
    const all3mf = fs
      .readdirSync(folder)
      .filter((f) => f.toLowerCase().endsWith(".3mf"));

    if (all3mf.length === 0) {
      console.log("[GCode] No .3mf files found in folder");
      return null;
    }

    // Strategy 1 — name match
    const baseName = path.basename(mqttGcodeFile, path.extname(mqttGcodeFile));
    const exactMatch = all3mf.find(
      (f) => path.basename(f, ".3mf").toLowerCase() === baseName.toLowerCase()
    );

    if (exactMatch) {
      console.log(`[GCode] Exact match: ${exactMatch}`);
      return extractFromFile(path.join(folder, exactMatch));
    }

    // Strategy 2 — check internal gcode entry name inside each .3mf
    for (const file of all3mf) {
      try {
        const zip = new AdmZip(path.join(folder, file));
        const gcodeEntry = zip
          .getEntries()
          .find((e) => e.entryName.endsWith(".gcode") && !e.isDirectory);

        if (
          gcodeEntry &&
          path.basename(gcodeEntry.entryName, ".gcode").toLowerCase() ===
            baseName.toLowerCase()
        ) {
          console.log(`[GCode] Internal match in ${file}: ${gcodeEntry.entryName}`);
          const gcode = gcodeEntry.getData().toString("utf8");
          return parseGcode(gcode);
        }
      } catch {
        // skip corrupt zips
      }
    }

    console.log(`[GCode] No .3mf matched "${mqttGcodeFile}" — skipping auto-deduction`);
    return null;
  } catch (err) {
    console.error("[GCode] Error reading folder:", err);
    return null;
  }
}

function extractFromFile(filePath: string): FilamentUsage[] | null {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const gcodeGzEntry = entries.find((e) => e.entryName.endsWith(".gcode.gz") && !e.isDirectory);
  const gcodeEntry   = entries.find((e) => e.entryName.endsWith(".gcode")    && !e.isDirectory);

  let gcode: string;
  if (gcodeGzEntry) {
    gcode = zlib.gunzipSync(gcodeGzEntry.getData()).toString("utf8");
  } else if (gcodeEntry) {
    gcode = gcodeEntry.getData().toString("utf8");
  } else {
    console.log("[GCode] No .gcode / .gcode.gz entry found inside .3mf");
    return null;
  }
  const result = parseGcode(gcode);

  if (!result) {
    console.log("[GCode] Could not parse filament data from gcode header");
  } else {
    console.log(
      `[GCode] Found ${result.length} filament(s):`,
      result.map((f) => `${f.colorHex} ${f.grams}g`).join(", ")
    );
  }

  return result;
}
