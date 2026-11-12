import { prisma } from "@/lib/db/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  const sales = await prisma.sale.findMany({
    where: clientId ? { clientId: Number(clientId) } : undefined,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(sales);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientId, status, items, totalAmount, paidAmount, notes } = body;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const sale = await prisma.sale.create({
    data: {
      clientId: Number(clientId),
      status: status ?? "confirmado",
      items: JSON.stringify(items ?? []),
      totalAmount: totalAmount ?? 0,
      paidAmount: paidAmount ?? 0,
      notes,
    },
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(sale, { status: 201 });
}
