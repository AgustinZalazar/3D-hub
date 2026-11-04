import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import path from "path";

export async function GET(req: NextRequest) {
  const fileName = req.nextUrl.searchParams.get("file");
  const entry    = req.nextUrl.searchParams.get("entry");
  const folder   = process.env.GCODE_FOLDER;

  if (!fileName || !entry || !folder) {
    return new NextResponse(null, { status: 400 });
  }

  // Safety: only allow filenames (no path traversal)
  const safe = path.basename(fileName);
  const filePath = path.join(folder, safe);

  try {
    const zip = new AdmZip(filePath);
    const data = zip.readFile(entry);
    if (!data) return new NextResponse(null, { status: 404 });

    return new NextResponse(data as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
