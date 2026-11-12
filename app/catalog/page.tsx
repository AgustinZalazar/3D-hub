import { prisma } from "@/lib/db/client";
import { BookOpen } from "lucide-react";
import { CatalogItemCard } from "@/components/catalog/catalog-item-card";
import { NewCatalogItemModal } from "@/components/catalog/new-catalog-item-modal";

export default async function CatalogPage() {
  const [items, quotes] = await Promise.all([
    prisma.catalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        entries: {
          include: {
            quote: {
              select: { id: true, name: true, salePrice: true, salePriceWithFee: true, filamentsData: true },
            },
          },
        },
      },
    }),
    prisma.productQuote.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, salePrice: true },
    }),
  ]);

  const published = items.filter((i) => i.isPublished);
  const hidden = items.filter((i) => !i.isPublished);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-semibold tracking-tight"
            style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}
          >
            Catálogo
          </h1>
          <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
            {published.length} producto{published.length !== 1 ? "s" : ""} publicado{published.length !== 1 ? "s" : ""}
            {hidden.length > 0 && ` · ${hidden.length} oculto${hidden.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <NewCatalogItemModal allQuotes={quotes} />
      </div>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <BookOpen size={32} strokeWidth={1.2} style={{ color: "var(--border)", marginBottom: "12px" }} />
          <p style={{ fontWeight: 500, color: "var(--t2)", marginBottom: "4px" }}>Catálogo vacío</p>
          <p style={{ fontSize: "13px", color: "var(--t3)" }}>
            Publicá productos desde las cotizaciones o creá uno nuevo
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {published.length > 0 && (
            <div>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                {published.map((item) => (
                  <CatalogItemCard key={item.id} item={item} allQuotes={quotes} />
                ))}
              </div>
            </div>
          )}

          {hidden.length > 0 && (
            <div>
              <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--t3)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Ocultos
              </p>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                {hidden.map((item) => (
                  <CatalogItemCard key={item.id} item={item} allQuotes={quotes} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
