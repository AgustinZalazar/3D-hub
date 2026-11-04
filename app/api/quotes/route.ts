import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const quotes = await prisma.productQuote.findMany({
    orderBy: { createdAt: "desc" },
    include: { printerProfile: { select: { name: true } } },
  });
  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const quote = await prisma.productQuote.create({
    data: {
      name:              body.name ?? "Sin nombre",
      modelFiles:        body.modelFiles        ? JSON.stringify(body.modelFiles)        : null,
      filamentsData:     JSON.stringify(body.filamentsData     ?? []),
      printHours:        parseFloat(body.printHours   ?? "0"),
      printMinutes:      parseFloat(body.printMinutes ?? "0"),
      printerProfileId:  body.printerProfileId  ? parseInt(body.printerProfileId) : null,
      wattage:           parseFloat(body.wattage        ?? "65"),
      kwHPrice:          parseFloat(body.kwHPrice       ?? "0"),
      lifeHours:         parseInt(body.lifeHours        ?? "5000"),
      partsPrice:        parseFloat(body.partsPrice     ?? "0"),
      errorMarginPct:    parseFloat(body.errorMarginPct ?? "15"),
      externalMaterials: JSON.stringify(body.externalMaterials ?? []),
      fixedCosts:        parseFloat(body.fixedCosts     ?? "0"),
      profitMode:        body.profitMode  ?? "multiplier",
      profitValue:       parseFloat(body.profitValue    ?? "4"),
      commissionPct:     parseFloat(body.commissionPct  ?? "0"),
      productionCost:    body.productionCost   != null ? parseFloat(body.productionCost)   : null,
      totalCost:         body.totalCost        != null ? parseFloat(body.totalCost)        : null,
      salePrice:         body.salePrice        != null ? parseFloat(body.salePrice)        : null,
      salePriceWithFee:  body.salePriceWithFee != null ? parseFloat(body.salePriceWithFee) : null,
    },
  });

  return NextResponse.json(quote, { status: 201 });
}
