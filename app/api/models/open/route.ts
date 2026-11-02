import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  const { fileName } = await req.json();
  const folder = process.env.GCODE_FOLDER;

  if (!fileName || !folder) return NextResponse.json({ ok: false });

  const safe     = path.basename(fileName); // prevent path traversal
  const filePath = path.join(folder, safe);

  // Windows: open with default associated app (Bambu Studio for .3mf)
  exec(`start "" "${filePath}"`);

  return NextResponse.json({ ok: true });
}
