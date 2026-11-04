import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.filament.update({
    where: { id: parseInt(id) },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const filament = await prisma.filament.update({
    where: { id: parseInt(id) },
    data: {
      brand:         body.brand         ?? undefined,
      material:      body.material      ?? undefined,
      color:         body.color         ?? undefined,
      colorHex:      body.colorHex      ?? undefined,
      initialWeight: body.initialWeight !== undefined ? parseFloat(body.initialWeight) : undefined,
      currentWeight: body.currentWeight !== undefined ? parseFloat(body.currentWeight) : undefined,
      spoolWeight:   body.spoolWeight   !== undefined ? parseFloat(body.spoolWeight)   : undefined,
      pricePerKg:    body.pricePerKg !== undefined ? (body.pricePerKg ? parseFloat(body.pricePerKg) : null) : undefined,
      notes:         body.notes         !== undefined ? body.notes : undefined,
    },
  });

  return NextResponse.json(filament);
}
