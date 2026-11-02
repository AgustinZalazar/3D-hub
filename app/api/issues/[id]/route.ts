import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.status === "resolved") data.resolvedAt = new Date();
  if (body.status === "open" || body.status === "tracking") data.resolvedAt = null;

  const issue = await prisma.issue.update({
    where: { id: parseInt(id) },
    data,
  });

  return NextResponse.json(issue);
}
