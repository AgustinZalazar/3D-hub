/**
 * FTP client for Bambu Lab printers.
 * Connects via implicit FTPS (port 990) to read gcode files directly from
 * the printer's SD card — gives us the actual model name and per-color
 * filament usage without relying on local file matching.
 */

import * as ftp from "basic-ftp";
import AdmZip from "adm-zip";
import { Writable } from "stream";
import { parseGcode, type FilamentUsage } from "../gcode/reader";

export interface PrinterFileInfo {
  name: string;
  size: number;
  modifiedAt: Date | null;
  path: string;
}

export interface FtpReadResult {
  fileName: string;
  filamentUsage: FilamentUsage[] | null;
}

// Directories to search for gcode files on the printer SD card
const SEARCH_PATHS = ["/", "/sdcard/", "/sdcard/gcodes/", "/sdcard/cache/", "/cache/", "/tmp/"];
const GCODE_EXTENSIONS = [".3mf", ".gcode.3mf", ".gcode"];

export async function readFilamentUsageFromPrinter(
  ip: string,
  accessCode: string,
  gcodeFileHint?: string
): Promise<FtpReadResult | null> {
  const client = new ftp.Client(5000); // 5s timeout
  client.ftp.verbose = false;

  try {
    await client.access({
      host: ip,
      port: 990,
      user: "bblp",
      password: accessCode,
      secure: "implicit",
      secureOptions: { rejectUnauthorized: false },
    });

    console.log("[FTP] Connected to printer");

    // Find gcode files across known directories
    const files = await listGcodeFiles(client);
    if (files.length === 0) {
      console.log("[FTP] No gcode files found on printer");
      return null;
    }

    console.log(`[FTP] Found ${files.length} file(s):`, files.map((f) => f.name).join(", "));

    // Pick the best candidate
    const target = selectFile(files, gcodeFileHint);
    if (!target) return null;

    console.log(`[FTP] Downloading: ${target.path} (${formatBytes(target.size)})`);

    const buffer = await downloadToBuffer(client, target.path);
    if (!buffer) return null;

    const filamentUsage = parseBufferAs3mf(buffer, target.name);
    return { fileName: target.name, filamentUsage };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[FTP] Failed: ${msg}`);
    return null;
  } finally {
    client.close();
  }
}

async function listGcodeFiles(client: ftp.Client): Promise<PrinterFileInfo[]> {
  const found: PrinterFileInfo[] = [];

  for (const dir of SEARCH_PATHS) {
    try {
      const list = await client.list(dir);

      // Log all entries in each dir for discovery (first pass only)
      if (list.length > 0) {
        console.log(`[FTP] ${dir} contents:`, list.map((e) => `${e.type === ftp.FileType.Directory ? "DIR" : "FILE"} ${e.name} (${e.size ?? 0}B)`).join(", "));
      }

      for (const entry of list) {
        if (entry.type !== ftp.FileType.File) continue;
        const name = entry.name;
        if (!GCODE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) continue;
        found.push({
          name,
          size: entry.size ?? 0,
          modifiedAt: entry.modifiedAt ?? null,
          path: dir + name,
        });
      }

      // Also recurse one level into subdirectories
      for (const entry of list) {
        if (entry.type !== ftp.FileType.Directory || entry.name === "." || entry.name === "..") continue;
        try {
          const subDir = dir + entry.name + "/";
          const subList = await client.list(subDir);
          for (const sub of subList) {
            if (sub.type !== ftp.FileType.File) continue;
            if (!GCODE_EXTENSIONS.some((ext) => sub.name.toLowerCase().endsWith(ext))) continue;
            found.push({
              name: sub.name,
              size: sub.size ?? 0,
              modifiedAt: sub.modifiedAt ?? null,
              path: subDir + sub.name,
            });
          }
        } catch {
          // subdirectory not accessible
        }
      }

      if (found.length > 0) break;
    } catch {
      // directory might not exist — try next
    }
  }

  return found;
}

function selectFile(files: PrinterFileInfo[], hint?: string): PrinterFileInfo | null {
  // If MQTT gave us a hint that actually matches a filename, use it
  if (hint) {
    const hintBase = hint.replace(/\.(gcode\.)?3mf$/i, "").toLowerCase();
    const exact = files.find((f) =>
      f.name.replace(/\.(gcode\.)?3mf$/i, "").toLowerCase() === hintBase
    );
    if (exact) {
      console.log(`[FTP] Matched by hint: ${exact.name}`);
      return exact;
    }
  }

  // Fall back to most recently modified file
  const sorted = [...files].sort((a, b) => {
    if (!a.modifiedAt) return 1;
    if (!b.modifiedAt) return -1;
    return b.modifiedAt.getTime() - a.modifiedAt.getTime();
  });

  const best = sorted[0];
  console.log(`[FTP] Using most recent: ${best.name}`);
  return best;
}

async function downloadToBuffer(client: ftp.Client, remotePath: string): Promise<Buffer | null> {
  try {
    const chunks: Buffer[] = [];
    const writer = new Writable({
      write(chunk: Buffer, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    });
    await client.downloadTo(writer, remotePath);
    return Buffer.concat(chunks);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[FTP] Download failed: ${msg}`);
    return null;
  }
}

function parseBufferAs3mf(buffer: Buffer, fileName: string): FilamentUsage[] | null {
  // Plain gcode file (not ZIP)
  if (!isZip(buffer)) {
    const gcode = buffer.slice(0, 16384).toString("utf8");
    const result = parseGcode(gcode);
    if (result) console.log(`[FTP] Parsed gcode header from ${fileName}`);
    return result;
  }

  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // Prefer Bambu's slice_info.config — structured XML with per-color data
    const sliceInfo = entries.find((e) => e.entryName === "Metadata/slice_info.config");
    if (sliceInfo) {
      const xml = sliceInfo.getData().toString("utf8");
      const result = parseSliceInfoXml(xml);
      if (result) {
        console.log(`[FTP] Parsed slice_info.config from ${fileName}:`, result.map((f) => `${f.colorHex} ${f.grams}g`).join(", "));
        return result;
      }
    }

    // Fall back to gcode header comments
    const gcodeEntry = entries.find((e) => e.entryName.endsWith(".gcode") && !e.isDirectory);
    if (gcodeEntry) {
      const header = gcodeEntry.getData().slice(0, 16384).toString("utf8");
      const result = parseGcode(header);
      if (result) {
        console.log(`[FTP] Parsed gcode header from ${fileName}:`, result.map((f) => `${f.colorHex} ${f.grams}g`).join(", "));
      }
      return result;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[FTP] ZIP parse error for ${fileName}: ${msg}`);
  }

  return null;
}

/**
 * Parses Bambu's slice_info.config XML for per-color filament usage.
 * Example: <filament color="FF0000FF" used_g="12.34" ... />
 */
function parseSliceInfoXml(xml: string): FilamentUsage[] | null {
  const filaments: FilamentUsage[] = [];
  const re = /<(?:used_material|filament)[^>]+color="([0-9A-Fa-f]{6,8})"[^>]+used_g="([\d.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1];
    // Bambu stores AARRGGBB — strip alpha if 8 chars
    const hex = raw.length === 8 ? `#${raw.slice(2)}` : `#${raw}`;
    const grams = parseFloat(m[2]);
    if (grams > 0) filaments.push({ colorHex: hex.toUpperCase(), grams });
  }
  return filaments.length > 0 ? filaments : null;
}

function isZip(buffer: Buffer): boolean {
  return buffer.length >= 4 &&
    buffer[0] === 0x50 && buffer[1] === 0x4b &&
    buffer[2] === 0x03 && buffer[3] === 0x04;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
