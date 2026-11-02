import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const job = await prisma.printJob.findFirst({
    where: { status: "running" },
    orderBy: { startedAt: "desc" },
    include: {
      filament: {
        select: { color: true, colorHex: true, material: true, brand: true },
      },
    },
  });
  return NextResponse.json(job);
}
