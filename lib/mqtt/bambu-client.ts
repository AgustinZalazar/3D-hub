import mqtt, { type MqttClient } from "mqtt";

export interface VtTray {
  trayColor: string;   // RRGGBB or AARRGGBB hex
  trayType: string;    // "PLA", "PETG", etc.
  colorHex: string;    // normalized #RRGGBB
}

export interface PrinterStatus {
  gcodeState: "IDLE" | "RUNNING" | "PAUSE" | "FINISH" | "FAILED" | "CANCEL";
  gcodeFile: string;
  mcPercent: number;
  mcRemainingTime: number; // minutes
  layerNum: number;
  totalLayerNum: number;
  nozzleTemper: number;
  bedTemper: number;
  printError: number;
  hmsErrors: HmsError[];
  filamentUsedMm: number; // raw mm from printer
  filamentUsedG: number;  // converted to grams (approximate)
  printRealDuration: number; // seconds
  vtTray?: VtTray;     // currently loaded filament (no AMS)
  subtaskName?: string;
  projectName?: string;
  taskId?: string;
}

export interface HmsError {
  code: string;
  rawCode: string;
}

export type PrinterStatusHandler = (status: Partial<PrinterStatus>) => void;
export type RawPrintHandler = (print: Record<string, unknown>) => void;

export class BambuMqttClient {
  private client: MqttClient | null = null;
  private handlers: PrinterStatusHandler[] = [];
  private rawHandlers: RawPrintHandler[] = [];

  constructor(
    private host: string,
    private serial: string,
    private accessCode: string
  ) {}

  connect() {
    this.client = mqtt.connect(`mqtts://${this.host}:8883`, {
      username: "bblp",
      password: this.accessCode,
      rejectUnauthorized: false,
      reconnectPeriod: 5000,
    });

    this.client.on("connect", () => {
      console.log("[MQTT] Connected to printer");
      this.client!.subscribe(`device/${this.serial}/report`);
    });

    this.client.on("message", (_topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        if (msg.print) {
          this.rawHandlers.forEach((h) => h(msg.print));
          this.handlePrintMessage(msg.print);
        }
      } catch {
        // ignore malformed messages
      }
    });

    this.client.on("error", (err) => {
      console.error("[MQTT] Error:", err.message);
    });

    this.client.on("reconnect", () => {
      console.log("[MQTT] Reconnecting...");
    });
  }

  private handlePrintMessage(print: Record<string, unknown>) {
    const status: Partial<PrinterStatus> = {};

    if (print.gcode_state) status.gcodeState = print.gcode_state as PrinterStatus["gcodeState"];
    if (print.gcode_file) status.gcodeFile = print.gcode_file as string;
    if (print.mc_percent !== undefined) status.mcPercent = print.mc_percent as number;
    if (print.mc_remaining_time !== undefined) status.mcRemainingTime = print.mc_remaining_time as number;
    if (print.layer_num !== undefined) status.layerNum = print.layer_num as number;
    if (print.total_layer_num !== undefined) status.totalLayerNum = print.total_layer_num as number;
    if (print.nozzle_temper !== undefined) status.nozzleTemper = print.nozzle_temper as number;
    if (print.bed_temper !== undefined) status.bedTemper = print.bed_temper as number;
    if (print.print_error !== undefined) status.printError = print.print_error as number;
    if (print.filament_used !== undefined) {
      const mm = print.filament_used as number;
      status.filamentUsedMm = mm;
      // approximate grams: PLA 1.75mm filament ≈ 2.98 g/m (updated from 2.4)
      status.filamentUsedG = Math.round((mm / 1000) * 2.98);
    }
    // Discovery fields — capture if printer sends them
    if (print.subtask_name) status.subtaskName = print.subtask_name as string;
    if (print.project_name) status.projectName = print.project_name as string;
    if (print.task_id) status.taskId = print.task_id as string;

    // vt_tray = filament loaded without AMS (virtual tray)
    if (print.vt_tray && typeof print.vt_tray === "object") {
      const tray = print.vt_tray as Record<string, unknown>;
      const raw = (tray.tray_color as string | undefined) ?? "";
      // Bambu stores AARRGGBB — strip alpha if 8 chars, else use as-is
      const colorHex = raw.length === 8 ? `#${raw.slice(2, 8)}` : raw.length === 6 ? `#${raw}` : null;
      if (colorHex) {
        status.vtTray = {
          trayColor: raw,
          trayType: (tray.tray_type as string | undefined) ?? "PLA",
          colorHex: colorHex.toUpperCase(),
        };
      }
    }
    if (print.print_real_duration !== undefined) status.printRealDuration = print.print_real_duration as number;

    if (Array.isArray(print.hms)) {
      status.hmsErrors = (print.hms as Array<{ attr: number; code: number }>).map((h) => ({
        rawCode: `${h.attr.toString(16).padStart(8, "0")}_${h.code.toString(16).padStart(8, "0")}`,
        code: parseHmsCode(h.attr, h.code),
      }));
    }

    this.handlers.forEach((h) => h(status));
  }

  onStatus(handler: PrinterStatusHandler) {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter((h) => h !== handler); };
  }

  onRawPrint(handler: RawPrintHandler) {
    this.rawHandlers.push(handler);
    return () => { this.rawHandlers = this.rawHandlers.filter((h) => h !== handler); };
  }

  disconnect() {
    this.client?.end();
  }
}

function parseHmsCode(attr: number, code: number): string {
  const attrHex = attr.toString(16).padStart(8, "0").toUpperCase();
  const codeHex = code.toString(16).padStart(8, "0").toUpperCase();
  return `${attrHex}_${codeHex}`;
}
