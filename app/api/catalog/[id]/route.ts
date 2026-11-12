import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.catalogItem.findUnique({
    where: { id: parseInt(id) },
    include: { entries: { include: { quote: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const itemId = parseInt(id);

  if (body.quoteIds !== undefined) {
    await prisma.catalogItemEntry.deleteMany({ where: { catalogItemId: itemId } });
    if (body.quoteIds.length > 0) {
      await prisma.catalogItemEntry.createMany({
        data: (body.quoteIds as number[]).map((qid: number) => ({
          catalogItemId: itemId,
          quoteId: qid,
          quantity: 1,
        })),
      });
    }
  }

  const item = await prisma.catalogItem.update({
    where: { id: itemId },
    data: {
      name:        body.name        !== undefined ? body.name        : undefined,
      description: body.description !== undefined ? body.description : undefined,
      photo:       body.photo       !== undefined ? body.photo       : undefined,
      price:         body.price         !== undefined ? (body.price != null ? parseFloat(body.price) : null) : undefined,
      colorVariants: body.colorVariants !== undefined ? (body.colorVariants != null ? JSON.stringify(body.colorVariants) : null) : undefined,
      isPublished:   body.isPublished   !== undefined ? body.isPublished   : undefined,
      sortOrder:   body.sortOrder   !== undefined ? body.sortOrder   : undefined,
    },
    include: { entries: { include: { quote: true } } },
  });

  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.catalogItem.findUnique({ where: { id: parseInt(id) } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (item.photo) {
    const { unlink } = await import("fs/promises");
    const { join } = await import("path");
    try {
      await unlink(join(process.cwd(), "public", item.photo));
    } catch {
      // ignore if file doesn't exist
    }
  }

  await prisma.catalogItem.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
