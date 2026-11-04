import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { sliceFile, writeCache } from "@/lib/slicer/bambu-cli";

const GCODE_FOLDER = process.env.GCODE_FOLDER ?? "";

export async function POST(req: NextRequest) {
  if (!GCODE_FOLDER) return NextResponse.json({ error: "GCODE_FOLDER not set" }, { status: 500 });

  const { fileName } = await req.json();
  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "fileName required" }, { status: 400 });
  }

  const filePath = path.join(GCODE_FOLDER, fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const data = sliceFile(filePath);
  if (!data) {
    return NextResponse.json({ error: "Slice failed — check BAMBU_STUDIO_PATH" }, { status: 500 });
  }

  writeCache(GCODE_FOLDER, fileName, data);
  return NextResponse.json(data);
}
