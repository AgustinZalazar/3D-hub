import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const jobs = await prisma.printJob.findMany({
      where: { status: { in: ["completed", "failed", "cancelled"] } },
      orderBy: { finishedAt: "desc" },
      take: 20,
    });

    const job = jobs.find((j) => j.pendingDeduction != null);
    if (!job) return NextResponse.json(null);

    return NextResponse.json({
      jobId: job.id,
      fileName: job.fileName,
      items: JSON.parse(job.pendingDeduction!),
    });
  } catch (err) {
    console.error("[API] deductions/pending error:", err);
    return NextResponse.json(null);
  }
}
