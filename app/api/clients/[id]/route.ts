import { prisma } from "@/lib/db/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: Number(params.id) },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, phone, email, address, notes } = body;
  const client = await prisma.client.update({
    where: { id: Number(params.id) },
    data: { name, phone, email, address, notes },
  });
  return NextResponse.json(client);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.client.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
