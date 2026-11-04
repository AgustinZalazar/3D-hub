import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand, material, color, colorHex, initialWeight, currentWeight, spoolWeight, pricePerKg, notes } = body;

  if (!brand || !material || !color || !initialWeight) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const weight = parseInt(initialWeight);
  const current = currentWeight ? parseInt(currentWeight) : weight;
  const spool = parseInt(spoolWeight ?? "200");

  const filament = await prisma.filament.create({
    data: {
      brand,
      material,
      color,
      colorHex: colorHex || null,
      initialWeight: weight,
      currentWeight: current,
      spoolWeight: spool,
      pricePerKg: pricePerKg ? parseFloat(pricePerKg) : null,
      notes: notes || null,
    },
  });

  return NextResponse.json(filament, { status: 201 });
}
