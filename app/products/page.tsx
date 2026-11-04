import { prisma } from "@/lib/db/client";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { ProductDeleteButton } from "@/components/products/product-delete-button";

export default async function ProductsPage() {
  const quotes = await prisma.productQuote.findMany({
    orderBy: { createdAt: "desc" },
    include: { printerProfile: { select: { name: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-semibold tracking-tight"
            style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}
          >
            Productos guardados
          </h1>
          <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
            {quotes.length} cotización{quotes.length !== 1 ? "es" : ""} guardada{quotes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/calculator"
          className="flex items-center gap-2 btn-primary"
          style={{ fontSize: "13px" }}
        >
          <Calculator size={14} />
          Nueva cotización
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Calculator size={32} strokeWidth={1.2} style={{ color: "var(--border)", marginBottom: "12px" }} />
          <p style={{ fontWeight: 500, color: "var(--t2)", marginBottom: "4px" }}>Sin cotizaciones</p>
          <p style={{ fontSize: "13px", color: "var(--t3)" }}>
            Usá la calculadora para crear y guardar tu primera cotización
          </p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {quotes.map((q) => {
            const filaments: { label: string; grams: number }[] = (() => {
              try { return JSON.parse(q.filamentsData); } catch { return []; }
            })();

            return (
              <div key={q.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p style={{ fontWeight: 600, fontSize: "15px", color: "var(--t1)", letterSpacing: "-0.01em" }} className="truncate">
                      {q.name}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "2px" }}>
                      {new Date(q.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/calculator?quote=${q.id}`}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ color: "var(--t3)" }}
                      title="Cargar en calculadora"
                    >
                      <Calculator size={14} />
                    </Link>
                    <ProductDeleteButton id={q.id} />
                  </div>
                </div>

                {filaments.length > 0 && (
                  <div style={{ fontSize: "12px", color: "var(--t3)" }}>
                    {filaments.map((f, i) => (
                      <span key={i}>
                        {i > 0 && " · "}
                        {f.label || `Filamento ${i + 1}`}
                        {f.grams > 0 && ` ${f.grams}g`}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex justify-between items-baseline">
                    <span style={{ fontSize: "11px", color: "var(--t3)" }}>Costo producción</span>
                    <span style={{ fontSize: "12px", color: "var(--t2)", fontVariantNumeric: "tabular-nums" }}>
                      $ {q.productionCost?.toLocaleString("es-AR", { minimumFractionDigits: 2 }) ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span style={{ fontSize: "12px", color: "var(--t2)", fontWeight: 500 }}>Precio de venta</span>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--t1)", fontVariantNumeric: "tabular-nums" }}>
                      $ {q.salePrice?.toLocaleString("es-AR", { minimumFractionDigits: 2 }) ?? "—"}
                    </span>
                  </div>
                  {q.commissionPct > 0 && q.salePriceWithFee != null && (
                    <div className="flex justify-between items-baseline mt-0.5">
                      <span style={{ fontSize: "11px", color: "var(--t3)" }}>Con comisión ({q.commissionPct}%)</span>
                      <span style={{ fontSize: "12px", color: "var(--t3)", fontVariantNumeric: "tabular-nums" }}>
                        $ {q.salePriceWithFee.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
