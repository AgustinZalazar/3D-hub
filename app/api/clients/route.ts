import { prisma } from "@/lib/db/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sales: {
        select: { id: true, status: true, totalAmount: true, paidAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, email, address, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const client = await prisma.client.create({
    data: { name: name.trim(), phone, email, address, notes },
  });
  return NextResponse.json(client, { status: 201 });
}
