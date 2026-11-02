/**
 * Standalone worker — runs separately from Next.js
 * Start with: npm run worker
 *
 * Connects to the Bambu Lab A1 Mini via MQTT (LAN mode),
 * persists print jobs and HMS issues to the database.
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { BambuMqttClient, type PrinterStatus } from "../lib/mqtt/bambu-client";
import { readFilamentUsageFrom3mf, readFilamentUsageFrom3mfRecent, type FilamentUsage } from "../lib/gcode/reader";
import { readFilamentUsageFromPrinter } from "../lib/ftp/bambu-ftp";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRINTER_IP = process.env.PRINTER_IP ?? "";
const PRINTER_SERIAL = process.env.PRINTER_SERIAL ?? "";
const PRINTER_ACCESS_CODE = process.env.PRINTER_ACCESS_CODE ?? "";

if (!PRINTER_IP || !PRINTER_SERIAL || !PRINTER_ACCESS_CODE) {
  console.error("Missing env vars: PRINTER_IP, PRINTER_SERIAL, PRINTER_ACCESS_CODE");
  process.exit(1);
}

const client = new BambuMqttClient(PRINTER_IP, PRINTER_SERIAL, PRINTER_ACCESS_CODE);

let currentJob: { id: number; fileName: string } | null = null;
let lastState: PrinterStatus["gcodeState"] | null = null;

// Bambu sends partial MQTT updates — accumulate state across messages
let printerState: Partial<PrinterStatus> = {};

// Snapshot of filament_used (mm) at the moment the job starts, to compute delta
let filamentUsedAtStart: number | null = null;
// Per-color usage fetched from printer FTP at job start
let ftpFilamentUsage: FilamentUsage[] | null = null;
let ftpFileName: string | null = null;

// Log all raw MQTT print fields on each state transition (for discovery)
let lastLoggedState: string | null = null;

client.onRawPrint((print) => {
  const state = print.gcode_state as string | undefined;
  if (state && state !== lastLoggedState) {
    lastLoggedState = state;
    const known = new Set([
      "gcode_state", "gcode_file", "mc_percent", "mc_remaining_time",
      "layer_num", "total_layer_num", "nozzle_temper", "bed_temper",
      "print_error", "filament_used", "print_real_duration", "hms",
    ]);
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(print)) {
      if (!known.has(k)) extra[k] = v;
    }
    if (Object.keys(extra).length > 0) {
      console.log(`[MQTT:raw] state=${state} unknown_fields=`, JSON.stringify(extra));
    }
    console.log(`[MQTT:raw] state=${state} filament_used=${print.filament_used ?? "-"}mm gcode_file=${print.gcode_file ?? "-"}`);
  }
});

client.onStatus(async (status) => {
  printerState = { ...printerState, ...status };

  if (status.gcodeState) {
    console.log(
      `[Worker] state=${status.gcodeState} file=${printerState.gcodeFile ?? "-"} ` +
      `filament=${printerState.filamentUsedG ?? "-"}g (${printerState.filamentUsedMm ?? "-"}mm raw)`
    );
  }

  // If a running job still has "unknown" filename and we now have the gcode_file, update it
  if (status.gcodeFile && currentJob && currentJob.fileName === "unknown") {
    currentJob.fileName = status.gcodeFile;
    prisma.printJob.update({ where: { id: currentJob.id }, data: { fileName: status.gcodeFile } }).catch(() => {});
    console.log(`[Worker] Job name updated from MQTT: ${status.gcodeFile}`);
  }

  if (!status.gcodeState) return;

  const state = status.gcodeState;

  if (state === "RUNNING" && lastState !== "RUNNING" && lastState !== "PAUSE") {
    // Reset printerState for the new job — preserve gcodeFile if it was already received
    const prevGcodeFile = printerState.gcodeFile;
    printerState = { ...status };
    if (!printerState.gcodeFile && prevGcodeFile) printerState.gcodeFile = prevGcodeFile;
    filamentUsedAtStart = printerState.filamentUsedMm ?? null;

    // If worker restarted mid-print, resume the existing running job
    const existing = await prisma.printJob.findFirst({
      where: { status: "running" },
      orderBy: { startedAt: "desc" },
    });

    if (existing) {
      currentJob = { id: existing.id, fileName: existing.fileName };
      console.log(`[Worker] Resumed tracking job: ${existing.fileName}`);
    } else {
      const fileName = printerState.gcodeFile ?? "unknown";
      const job = await prisma.printJob.create({
        data: { fileName, status: "running", startedAt: new Date() },
      });
      currentJob = { id: job.id, fileName: job.fileName };
      console.log(`[Worker] Print started: ${job.fileName}`);
    }

    // Fetch per-color usage from printer FTP in the background (non-blocking)
    ftpFilamentUsage = null;
    ftpFileName = null;
    readFilamentUsageFromPrinter(PRINTER_IP, PRINTER_ACCESS_CODE, printerState.gcodeFile)
      .then((result) => {
        if (result) {
          ftpFilamentUsage = result.filamentUsage;
          ftpFileName = result.fileName;
          // Update job filename with actual model name from printer if we got one
          if (currentJob && ftpFileName && ftpFileName !== "unknown") {
            prisma.printJob.update({
              where: { id: currentJob.id },
              data: { fileName: ftpFileName },
            }).catch(() => {});
          }
          console.log(`[FTP] Per-color data ready for job — ${ftpFileName}: ${ftpFilamentUsage?.map((f) => `${f.colorHex} ${f.grams}g`).join(", ") ?? "none"}`);
        }
      })
      .catch((err) => {
        console.log("[FTP] Background fetch error:", err instanceof Error ? err.message : String(err));
      });
  }

  if (currentJob && (state === "FINISH" || state === "FAILED" || state === "CANCEL")) {
    const finalStatus =
      state === "FINISH" ? "completed" : state === "FAILED" ? "failed" : "cancelled";

    // Compute delta from start snapshot if available; otherwise use absolute value
    const rawMm = printerState.filamentUsedMm;
    let filamentUsedG = printerState.filamentUsedG ?? null;

    if (rawMm !== undefined && filamentUsedAtStart !== null) {
      const deltaMm = rawMm - filamentUsedAtStart;
      // PLA 1.75mm: π × 0.875² × density 1.24 ≈ 2.98 g/m
      filamentUsedG = Math.round((deltaMm / 1000) * 2.98);
      console.log(`[Worker] filament delta: ${deltaMm}mm (start=${filamentUsedAtStart}mm) → ${filamentUsedG}g`);
    }

    const durationSeconds = printerState.printRealDuration;

    await prisma.printJob.update({
      where: { id: currentJob.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        filamentUsedGrams: filamentUsedG ?? null,
        durationSeconds: durationSeconds ?? null,
      },
    });

    await deductFilamentStock(filamentUsedG, currentJob.id, currentJob.fileName, ftpFilamentUsage, printerState.vtTray ?? null);

    console.log(`[Worker] Print ${finalStatus}: ${currentJob.fileName} — ${filamentUsedG ?? "?"}g used`);
    currentJob = null;
    filamentUsedAtStart = null;
    ftpFilamentUsage = null;
    ftpFileName = null;
    // NOTE: do NOT reset printerState here — the final filament_used may arrive
    // in a message slightly after gcode_state=FINISH. Reset on next RUNNING start.
  }

  if (status.hmsErrors?.length) {
    for (const err of status.hmsErrors) {
      const existing = await prisma.issue.findFirst({
        where: { code: err.code, status: { not: "resolved" } },
      });
      if (!existing) {
        await prisma.issue.create({
          data: {
            type: "hms",
            severity: "error",
            code: err.code,
            title: resolveHmsTitle(err.code),
            printJobId: currentJob?.id,
          },
        });
        console.log(`[Worker] HMS issue logged: ${err.code}`);
      }
    }
  }

  lastState = state;
});

client.connect();
console.log("[Worker] Printer MQTT worker started");

process.on("SIGINT", async () => {
  client.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

function resolveHmsTitle(code: string): string {
  const known: Record<string, string> = {
    "07000000_07000000": "Filament jam detected",
    "05000000_05000000": "Nozzle temperature fault",
    "03000000_03000000": "Bed temperature fault",
    "0C000000_0C000000": "Fan error detected",
  };
  return known[code] ?? `HMS error: ${code}`;
}

async function deductFilamentStock(
  totalGrams: number | null,
  jobId: number,
  gcodeFile: string,
  ftpUsage: FilamentUsage[] | null,
  vtTray: import("../lib/mqtt/bambu-client").VtTray | null
) {
  const gcodeFolder = process.env.GCODE_FOLDER;
  const filaments = await prisma.filament.findMany({ where: { isActive: true } });

  type PendingItem = {
    colorHex: string;
    grams: number;
    filamentId: number | null;
    filamentLabel: string;
    editable: boolean;
  };

  const toItems = (usage: FilamentUsage[]): PendingItem[] =>
    usage.map((u) => {
      const match = filaments.find(
        (f) => (f.colorHex ?? "").replace("#", "").toLowerCase() === u.colorHex.replace("#", "").toLowerCase()
      );
      return {
        colorHex: u.colorHex,
        grams: u.grams,
        filamentId: match?.id ?? null,
        filamentLabel: match ? `${match.brand} ${match.material} — ${match.color}` : "Sin coincidencia",
        editable: false,
      };
    });

  let pending: PendingItem[] = [];

  // Source 1 — FTP: per-color data read directly from the printer (most accurate)
  if (ftpUsage && ftpUsage.length > 0) {
    pending = toItems(ftpUsage);
    console.log(`[Worker] Using FTP per-color data for job ${jobId}`);
  }

  // Source 2 — Local .3mf: per-color from file in GCODE_FOLDER
  if (pending.length === 0 && gcodeFolder) {
    const usage = readFilamentUsageFrom3mf(gcodeFolder, gcodeFile) ??
                  readFilamentUsageFrom3mfRecent(gcodeFolder, 2);
    if (usage && usage.length > 0) {
      pending = toItems(usage);
      console.log(`[Worker] Using local .3mf per-color data for job ${jobId}`);
    }
  }

  // Source 3 — MQTT total: single-filament deduction using computed grams
  // Use vt_tray color to find the exact filament, fall back to most recently updated
  if (pending.length === 0 && totalGrams && totalGrams > 0) {
    let active = vtTray
      ? filaments.find(
          (f) => (f.colorHex ?? "").replace("#", "").toLowerCase() === vtTray.colorHex.replace("#", "").toLowerCase()
        ) ?? null
      : null;

    if (!active) {
      active = await prisma.filament.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
    }

    if (active) {
      const source = vtTray ? "vt_tray color" : "most recent";
      pending = [{
        colorHex: vtTray?.colorHex ?? active.colorHex ?? "#888888",
        grams: totalGrams,
        filamentId: active.id,
        filamentLabel: `${active.brand} ${active.material} — ${active.color}`,
        editable: false,
      }];
      console.log(`[Worker] Using MQTT total (${totalGrams}g) matched by ${source} for job ${jobId}`);
    }
  }

  // Source 4 — Manual: show active filaments at 0g for user to fill in
  if (pending.length === 0 && filaments.length > 0) {
    pending = filaments.slice(0, 3).map((f) => ({
      colorHex: f.colorHex ?? "#888888",
      grams: 0,
      filamentId: f.id,
      filamentLabel: `${f.brand} ${f.material} — ${f.color}`,
      editable: true,
    }));
    console.log(`[Worker] No automatic data — showing manual entry for job ${jobId}`);
  }

  if (pending.length === 0) return;

  await prisma.printJob.update({
    where: { id: jobId },
    data: { pendingDeduction: JSON.stringify(pending) },
  });
  console.log(
    `[Worker] Pending deduction saved for job ${jobId}:`,
    pending.map((p) => `${p.filamentLabel} ${p.grams}g${p.editable ? " (editable)" : ""}`).join(", ")
  );
}
