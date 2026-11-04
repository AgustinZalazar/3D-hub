import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const profiles = await prisma.printerProfile.findMany({ orderBy: { isDefault: "desc" } });
  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, wattage, kwHPrice, lifeHours, partsPrice, errorMarginPct, isDefault } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  if (isDefault) {
    await prisma.printerProfile.updateMany({ data: { isDefault: false } });
  }

  const profile = await prisma.printerProfile.create({
    data: {
      name,
      wattage:        parseFloat(wattage ?? "65"),
      kwHPrice:       parseFloat(kwHPrice ?? "0"),
      lifeHours:      parseInt(lifeHours ?? "5000"),
      partsPrice:     parseFloat(partsPrice ?? "0"),
      errorMarginPct: parseFloat(errorMarginPct ?? "15"),
      isDefault:      Boolean(isDefault),
    },
  });

  return NextResponse.json(profile, { status: 201 });
}
