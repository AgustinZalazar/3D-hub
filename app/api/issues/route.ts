import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, severity } = body;

  if (!title || !severity) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const issue = await prisma.issue.create({
    data: {
      type: "manual",
      severity,
      title,
      description: description || null,
      status: "open",
    },
  });

  return NextResponse.json(issue, { status: 201 });
}
