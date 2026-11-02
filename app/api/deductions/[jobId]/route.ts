import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

type Item = { colorHex: string; grams: number; filamentId: number | null };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { action, items: clientItems } = await req.json(); // "confirm" | "cancel"
  const id = parseInt(jobId);

  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job?.pendingDeduction) return NextResponse.json({ ok: false });

  if (action === "confirm") {
    // Use client-provided items (may have edited grams) or fall back to DB
    const items: Item[] = clientItems ?? JSON.parse(job.pendingDeduction);
    for (const item of items) {
      if (!item.filamentId || item.grams <= 0) continue;
      const filament = await prisma.filament.findUnique({ where: { id: item.filamentId } });
      if (!filament) continue;
      await prisma.filament.update({
        where: { id: item.filamentId },
        data: { currentWeight: Math.max(0, filament.currentWeight - item.grams) },
      });
    }
    const firstWithFilament = items.find((i) => i.filamentId);
    await prisma.printJob.update({
      where: { id },
      data: {
        pendingDeduction: null,
        filamentId: firstWithFilament?.filamentId ?? null,
      },
    });
  } else {
    await prisma.printJob.update({ where: { id }, data: { pendingDeduction: null } });
  }

  return NextResponse.json({ ok: true });
}
