import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";

// Re-export from reader to keep logic in one place
import { parse3mfGeometry, estimateFromGeometry, extractFilamentsFromConfig } from "@/lib/gcode/reader";

export async function GET(req: NextRequest) {
  const fileName = req.nextUrl.searchParams.get("file");
  const folder = process.env.GCODE_FOLDER ?? "";

  if (!fileName || !folder) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const filePath = path.join(folder, fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const filaments = extractFilamentsFromConfig(zip, entries);
    const geo = parse3mfGeometry(zip);

    if (!geo) {
      return NextResponse.json({ totalGrams: 0, estimatedSeconds: null, filaments, dataSource: "none" });
    }

    const { grams, estimatedSeconds } = estimateFromGeometry(geo);
    const perFilament = filaments.length > 0 ? grams / filaments.length : grams;
    const filamentsWithGrams = filaments.length > 0
      ? filaments.map((f) => ({ ...f, grams: perFilament }))
      : [{ colorHex: "#888888", material: "PLA", grams }];

    return NextResponse.json({
      totalGrams: Math.round(grams * 10) / 10,
      estimatedSeconds,
      filaments: filamentsWithGrams,
      dataSource: "geometry",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
