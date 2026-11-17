import { prisma } from "@/lib/db/client";
import { VentasClient } from "@/components/ventas/ventas-client";

export default async function VentasPage() {
  const [sales, clients, catalogItems] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.catalogItem.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        colorVariants: true,
        entries: {
          select: { quote: { select: { salePrice: true, salePriceWithFee: true } } },
        },
      },
    }),
  ]);

  return <VentasClient initialSales={sales as any} clients={clients} catalogItems={catalogItems as any} />;
}
