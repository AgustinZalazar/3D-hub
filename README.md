# 3D Hub

Local management hub for a Bambu Lab A1 Mini (no AMS). Runs entirely on your local network — no cloud, no external accounts.

## Features

- **Dashboard** — live print status card with elapsed time, animated printer SVG, and filament info
- **Filament stock** — track multiple spools with spool visualization, current weight, and per-material stats
- **Automatic deduction** — when a print finishes, a modal shows what was used (per color when possible) and deducts from stock after confirmation
- **Models** — browse your `.3mf` files with thumbnails extracted from the files, filter by material and tags, open directly in Bambu Studio
- **Issue tracker** — HMS error codes from the printer logged automatically, plus manual issue creation

## How it works

Two processes run in parallel:

| Process | Command | What it does |
|---|---|---|
| Next.js app | `npm run dev` | Web UI served at `localhost:3000` |
| MQTT worker | `npm run worker` | Connects to the printer via LAN and writes to the DB |

The worker connects to the printer's MQTT broker (`mqtts://<ip>:8883`) and tracks print state. When a job finishes it tries to determine filament usage in this order:

1. **FTP** — connects to the printer (`ftps://<ip>:990`) and reads the gcode file directly for exact per-color data
2. **Local .3mf** — matches against files in your gcode folder by name or most-recently-modified
3. **MQTT total** — uses the `filament_used` field from MQTT, matched to the loaded filament color via `vt_tray`
4. **Manual** — shows active filaments at 0g for you to fill in

## Requirements

- Node.js 20+
- A Bambu Lab printer in **LAN mode** (Settings → Network → LAN Mode Lossless)
- Your printer's **IP address**, **serial number**, and **access code** (all visible in the printer's screen under Network)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
PRINTER_IP=192.168.x.x
PRINTER_SERIAL=0300XXXXXXXXXX
PRINTER_ACCESS_CODE=12345678
GCODE_FOLDER=C:\Users\you\path\to\your\3mf\files
```

| Variable | Where to find it |
|---|---|
| `PRINTER_IP` | Printer screen → Settings → Network |
| `PRINTER_SERIAL` | Printer screen → Settings → Device |
| `PRINTER_ACCESS_CODE` | Printer screen → Settings → Network |
| `GCODE_FOLDER` | Folder on your PC where you save `.3mf` files from Bambu Studio |

### 3. Initialize the database

```bash
npm run db:push
```

This creates a SQLite database at `data/3dhub.db`.

### 4. Run

Open two terminals:

```bash
# Terminal 1 — web app
npm run dev

# Terminal 2 — printer worker
npm run worker
```

Then open [http://localhost:3000](http://localhost:3000).

## Database

SQLite via Prisma, stored at `data/3dhub.db`. No external database needed.

To explore data visually:

```bash
npm run db:studio
```

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Prisma** + SQLite
- **MQTT** (`mqtt` package) — Bambu Lab LAN API
- **FTP** (`basic-ftp`) — reads gcode files from the printer's SD card
- **adm-zip** — extracts thumbnails and metadata from `.3mf` files
