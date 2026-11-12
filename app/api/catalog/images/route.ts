import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = extname(file.name).toLowerCase() || ".jpg";
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
  }

  const name = `${randomBytes(12).toString("hex")}${ext}`;
  const dir = join(process.cwd(), "public", "catalog-images");
  await mkdir(dir, { recursive: true });

  const bytes = await file.arrayBuffer();
  await writeFile(join(dir, name), Buffer.from(bytes));

  return NextResponse.json({ path: `/catalog-images/${name}` }, { status: 201 });
}
