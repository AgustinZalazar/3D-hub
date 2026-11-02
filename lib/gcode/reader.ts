import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";

export interface FilamentUsage {
  colorHex: string;
  grams: number;
}

export interface ModelMetadata {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  modifiedAt: Date;
  thumbnailEntry: string | null; // entry name inside zip
  filaments: { colorHex: string; material: string; grams: number }[];
  totalGrams: number;
  estimatedSeconds: number | null;
  layerHeight: number | null;
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
        };
      }
    });
  } catch {
    return [];
  }
}

function extractMetadata(f: { fileName: string; filePath: string; sizeBytes: number; modifiedAt: Date }): ModelMetadata {
  const zip = new AdmZip(f.filePath);
  const entries = zip.getEntries();

  // Thumbnail — try common Bambu Studio paths
  const thumbnailEntry =
    entries.find((e) => /plate_\d+\.png$/i.test(e.entryName) && !e.isDirectory)?.entryName ??
    entries.find((e) => /thumbnail.*\.png$/i.test(e.entryName) && !e.isDirectory)?.entryName ??
    entries.find((e) => e.entryName.endsWith(".png") && !e.isDirectory)?.entryName ??
    null;

  // Gcode — read only first 12KB for header
  const gcodeEntry = entries.find((e) => e.entryName.endsWith(".gcode") && !e.isDirectory);
  if (!gcodeEntry) return { ...f, thumbnailEntry, filaments: [], totalGrams: 0, estimatedSeconds: null, layerHeight: null };

  const header = gcodeEntry.getData().slice(0, 12288).toString("utf8");

  const colorMatch  = header.match(/;\s*filament_colour\s*=\s*([^\n\r]+)/);
  const gramsMatch  = header.match(/;\s*filament used \[g\]\s*=\s*([^\n\r]+)/);
  const typeMatch   = header.match(/;\s*filament_type\s*=\s*([^\n\r]+)/);
  const timeMatch   = header.match(/;\s*(?:estimated printing time|print_time)\s*=\s*([^\n\r]+)/i);
  const layerMatch  = header.match(/;\s*layer_height\s*=\s*([\d.]+)/);

  const colors    = colorMatch ? colorMatch[1].trim().split(";").map((c) => normalizeHex(c.trim())) : [];
  const grams     = gramsMatch ? gramsMatch[1].trim().split(";").map((g) => parseFloat(g)) : [];
  const materials = typeMatch  ? typeMatch[1].trim().split(";").map((t) => t.trim()) : [];

  const filaments = colors.map((colorHex, i) => ({
    colorHex,
    material: materials[i] ?? "PLA",
    grams: grams[i] ?? 0,
  })).filter((f) => f.grams > 0 || colors.length === 1);

  const totalGrams = filaments.reduce((s, f) => s + f.grams, 0);

  // Parse print time — could be "1h 23m 45s" or raw seconds
  let estimatedSeconds: number | null = null;
  if (timeMatch) {
    const raw = timeMatch[1].trim();
    if (/^\d+$/.test(raw)) {
      estimatedSeconds = parseInt(raw);
    } else {
      let secs = 0;
      const h = raw.match(/(\d+)h/);
      const m = raw.match(/(\d+)m/);
      const s = raw.match(/(\d+)s/);
      if (h) secs += parseInt(h[1]) * 3600;
      if (m) secs += parseInt(m[1]) * 60;
      if (s) secs += parseInt(s[1]);
      if (secs > 0) estimatedSeconds = secs;
    }
  }

  const layerHeight = layerMatch ? parseFloat(layerMatch[1]) : null;

  return { ...f, thumbnailEntry, filaments, totalGrams, estimatedSeconds, layerHeight };
}


/**
 * Parses a Bambu Studio gcode string for per-filament usage.
 * Looks for lines like:
 *   ; filament_colour = #FF0000;#FFFFFF
 *   ; filament used [g] = 12.34;56.78
 */
export function parseGcode(gcode: string): FilamentUsage[] | null {
  const colorMatch = gcode.match(/;\s*filament_colour\s*=\s*([^\n]+)/);
  const gramsMatch = gcode.match(/;\s*filament used \[g\]\s*=\s*([^\n]+)/);

  if (!colorMatch || !gramsMatch) return null;

  const colors = colorMatch[1].trim().split(";").map((c) => c.trim());
  const grams  = gramsMatch[1].trim().split(";").map((g) => parseFloat(g.trim()));

  if (colors.length !== grams.length) return null;

  return colors
    .map((hex, i) => ({ colorHex: normalizeHex(hex), grams: grams[i] }))
    .filter((f) => f.grams > 0);
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
  const gcodeEntry = zip
    .getEntries()
    .find((e) => e.entryName.endsWith(".gcode") && !e.isDirectory);

  if (!gcodeEntry) {
    console.log("[GCode] No .gcode entry found inside .3mf");
    return null;
  }

  const gcode = gcodeEntry.getData().toString("utf8");
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
