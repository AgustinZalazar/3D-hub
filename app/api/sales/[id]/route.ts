import { prisma } from "@/lib/db/client";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { status, items, totalAmount, paidAmount, notes, deliveredAt } = body;

  const sale = await prisma.sale.update({
    where: { id: Number(params.id) },
    data: {
      ...(status !== undefined && { status }),
      ...(items !== undefined && { items: JSON.stringify(items) }),
      ...(totalAmount !== undefined && { totalAmount }),
      ...(paidAmount !== undefined && { paidAmount }),
      ...(notes !== undefined && { notes }),
      ...(deliveredAt !== undefined && { deliveredAt: deliveredAt ? new Date(deliveredAt) : null }),
    },
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(sale);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.sale.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
