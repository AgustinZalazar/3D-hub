"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff, Package } from "lucide-react";
import { CatalogEditModal } from "./catalog-edit-modal";

interface Quote {
  id: number;
  name: string;
  salePrice: number | null;
}

interface Entry {
  id: number;
  quoteId: number;
  quantity: number;
  quote: Quote;
}

interface CatalogItemData {
  id: number;
  name: string;
  description: string | null;
  photo: string | null;
  price: number | null;
  colorVariants: string | null;
  isPublished: boolean;
  entries: Entry[];
}

interface Props {
  item: CatalogItemData;
  allQuotes: Quote[];
}

export function CatalogItemCard({ item, allQuotes }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const derivedPrice = item.price ?? item.entries.reduce((sum, e) => {
    return sum + (e.quote.salePrice ?? 0) * e.quantity;
  }, 0);

  const isCombo = item.entries.length > 1;

  const colorVariants: { id: string; label: string; price: string }[] = (() => {
    try { return JSON.parse(item.colorVariants ?? "[]"); } catch { return []; }
  })();

  const fmtPrice = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  async function togglePublish() {
    setLoading(true);
    await fetch(`/api/catalog/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !item.isPublished }),
    });
    router.refresh();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${item.name}" del catálogo?`)) return;
    setLoading(true);
    await fetch(`/api/catalog/${item.id}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      <div
        className="card flex flex-col overflow-hidden"
        style={{ opacity: item.isPublished ? 1 : 0.6, transition: "opacity 150ms" }}
      >
        {/* Photo */}
        <div
          className="relative flex items-center justify-center"
          style={{ height: "180px", background: "var(--page-bg)", flexShrink: 0 }}
        >
          {item.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photo}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package size={40} strokeWidth={1.2} style={{ color: "var(--border)" }} />
          )}
          {isCombo && (
            <span
              className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ background: "var(--accent)", color: "white", fontSize: "10px" }}
            >
              COMBO
            </span>
          )}
          {!item.isPublished && (
            <span
              className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ background: "var(--page-bg)", color: "var(--t3)", border: "1px solid var(--border)", fontSize: "10px" }}
            >
              Oculto
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4 gap-2">
          <div>
            <p style={{ fontWeight: 600, fontSize: "15px", color: "var(--t1)", letterSpacing: "-0.01em" }}>
              {item.name}
            </p>
            {item.description && (
              <p
                style={{ fontSize: "12px", color: "var(--t3)", marginTop: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {item.description}
              </p>
            )}
          </div>

          {isCombo && (
            <div style={{ fontSize: "11px", color: "var(--t3)" }}>
              {item.entries.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && " + "}
                  {e.quantity > 1 && `${e.quantity}× `}{e.quote.name}
                </span>
              ))}
            </div>
          )}

          {colorVariants.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
              {colorVariants.map((v) => {
                const p = fmtPrice(v.price);
                return (
                  <span
                    key={v.id}
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "20px",
                      background: "var(--accent-bg)",
                      color: "var(--accent-text)",
                      border: "1px solid var(--accent-border)",
                      fontWeight: 500,
                    }}
                  >
                    {v.label}{p ? ` $${p}` : ""}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-auto pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--t1)", fontVariantNumeric: "tabular-nums" }}>
                $ {derivedPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={togglePublish}
                  disabled={loading}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: "var(--t3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--t1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t3)")}
                  title={item.isPublished ? "Ocultar" : "Publicar"}
                >
                  {item.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: "var(--t3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--t1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t3)")}
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: "var(--t3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t3)")}
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editOpen && (
        <CatalogEditModal
          item={item}
          allQuotes={allQuotes}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
