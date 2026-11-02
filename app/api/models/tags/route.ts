import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// GET /api/models/tags — all tags grouped by fileName
// GET /api/models/tags?file=X — tags for one file
export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  try {
    if (file) {
      const rows = await prisma.$queryRaw<{ tag: string }[]>`
        SELECT tag FROM ModelTag WHERE fileName = ${file} ORDER BY tag ASC
      `;
      return NextResponse.json(rows.map((r) => r.tag));
    }
    // All tags: { fileName, tags: string[] }[]
    const rows = await prisma.$queryRaw<{ fileName: string; tag: string }[]>`
      SELECT fileName, tag FROM ModelTag ORDER BY fileName, tag ASC
    `;
    const map = new Map<string, string[]>();
    for (const r of rows) {
      if (!map.has(r.fileName)) map.set(r.fileName, []);
      map.get(r.fileName)!.push(r.tag);
    }
    return NextResponse.json(Object.fromEntries(map));
  } catch {
    return NextResponse.json(file ? [] : {});
  }
}

// POST /api/models/tags — { fileName, tag }
export async function POST(req: NextRequest) {
  const { fileName, tag } = await req.json();
  if (!fileName || !tag) return NextResponse.json({ ok: false });
  try {
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO ModelTag (fileName, tag) VALUES (${fileName}, ${tag})
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

// DELETE /api/models/tags — { fileName, tag }
export async function DELETE(req: NextRequest) {
  const { fileName, tag } = await req.json();
  if (!fileName || !tag) return NextResponse.json({ ok: false });
  try {
    await prisma.$executeRaw`
      DELETE FROM ModelTag WHERE fileName = ${fileName} AND tag = ${tag}
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
