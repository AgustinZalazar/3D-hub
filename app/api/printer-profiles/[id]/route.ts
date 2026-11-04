import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.isDefault) {
    await prisma.printerProfile.updateMany({ data: { isDefault: false } });
  }

  const profile = await prisma.printerProfile.update({
    where: { id: parseInt(id) },
    data: {
      name:           body.name           ?? undefined,
      wattage:        body.wattage        !== undefined ? parseFloat(body.wattage)        : undefined,
      kwHPrice:       body.kwHPrice       !== undefined ? parseFloat(body.kwHPrice)       : undefined,
      lifeHours:      body.lifeHours      !== undefined ? parseInt(body.lifeHours)        : undefined,
      partsPrice:     body.partsPrice     !== undefined ? parseFloat(body.partsPrice)     : undefined,
      errorMarginPct: body.errorMarginPct !== undefined ? parseFloat(body.errorMarginPct) : undefined,
      isDefault:      body.isDefault      !== undefined ? Boolean(body.isDefault)         : undefined,
    },
  });

  return NextResponse.json(profile);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.printerProfile.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
