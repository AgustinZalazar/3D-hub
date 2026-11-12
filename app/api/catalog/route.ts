import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const items = await prisma.catalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      entries: {
        include: {
          quote: {
            select: {
              id: true,
              name: true,
              salePrice: true,
              salePriceWithFee: true,
              filamentsData: true,
            },
          },
        },
      },
    },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const item = await prisma.catalogItem.create({
    data: {
      name:          body.name ?? "Sin nombre",
      description:   body.description ?? null,
      photo:         body.photo ?? null,
      price:         body.price != null ? parseFloat(body.price) : null,
      colorVariants: body.colorVariants != null ? JSON.stringify(body.colorVariants) : null,
      isPublished:   body.isPublished ?? true,
      sortOrder:   body.sortOrder ?? 0,
      entries: body.quoteIds?.length
        ? {
            create: (body.quoteIds as number[]).map((qid: number) => ({
              quoteId: qid,
              quantity: 1,
            })),
          }
        : undefined,
    },
    include: {
      entries: { include: { quote: true } },
    },
  });

  return NextResponse.json(item, { status: 201 });
}
