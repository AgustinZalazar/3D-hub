import { prisma } from "@/lib/db/client";
import { ClientsClient } from "@/components/clients/clients-client";

export default async function ClientsPage() {
  const [clients, catalogItems] = await Promise.all([
    prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: { sales: { orderBy: { createdAt: "desc" } } },
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

  return <ClientsClient initialClients={clients as any} catalogItems={catalogItems as any} />;
}
