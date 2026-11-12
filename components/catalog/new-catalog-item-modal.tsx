"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Image as ImageIcon, Upload } from "lucide-react";

interface Quote {
  id: number;
  name: string;
  salePrice: number | null;
}

interface Props {
  allQuotes: Quote[];
}

export function NewCatalogItemModal({ allQuotes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<number[]>([]);
  const [variants, setVariants] = useState<{ id: string; label: string; price: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setName("");
    setDescription("");
    setPrice("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setSelectedQuoteIds([]);
    setVariants([]);
    setOpen(true);
  }

  function addVariant() {
    setVariants((prev) => [...prev, { id: Math.random().toString(36).slice(2), label: "", price: "" }]);
  }

  function removeVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  }

  function updateVariant(id: string, field: "label" | "price", value: string) {
    setVariants((prev) => prev.map((v) => v.id === id ? { ...v, [field]: value } : v));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  function toggleQuote(qid: number) {
    setSelectedQuoteIds((prev) =>
      prev.includes(qid) ? prev.filter((id) => id !== qid) : [...prev, qid]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedQuoteIds.length === 0) return;
    setLoading(true);

    let photoPath: string | null = null;
    if (photoFile) {
      const fd = new FormData();
      fd.append("file", photoFile);
      const res = await fetch("/api/catalog/images", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        photoPath = data.path;
      }
    }

    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        photo: photoPath,
        price: price ? parseFloat(price) : null,
        colorVariants: variants.length > 0 ? variants : null,
        quoteIds: selectedQuoteIds,
      }),
    });

    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={openModal} className="flex items-center gap-2 btn-primary" style={{ fontSize: "13px" }}>
        <Plus size={14} />
        Nuevo producto
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 0.45)", animation: "backdrop-in 150ms ease" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="card w-full max-w-lg"
            style={{ animation: "modal-in 200ms var(--ease-out)", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontWeight: 600, fontSize: "15px", color: "var(--t1)" }}>
                Nuevo producto en catálogo
              </p>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-md" style={{ color: "var(--t3)" }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              {/* Photo */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
                  Foto del producto
                </label>
                <div
                  className="relative flex items-center justify-center rounded-lg overflow-hidden cursor-pointer"
                  style={{ height: "160px", border: "2px dashed var(--border)", background: "var(--page-bg)" }}
                  onClick={() => fileRef.current?.click()}
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2" style={{ color: "var(--t3)" }}>
                      <ImageIcon size={28} strokeWidth={1.3} />
                      <span style={{ fontSize: "12px" }}>Click para subir foto</span>
                    </div>
                  )}
                  {photoPreview && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      style={{ background: "oklch(0 0 0 / 0.4)" }}>
                      <Upload size={20} style={{ color: "white" }} />
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
              </div>

              {/* Name */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
                  Nombre *
                </label>
                <input
                  className="field-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ej: Kit organizador escritorio"
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
                  Descripción
                </label>
                <textarea
                  className="field-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Materiales, dimensiones, usos..."
                  rows={3}
                  style={{ resize: "vertical", minHeight: "72px" }}
                />
              </div>

              {/* Price */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
                  Precio de venta
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: "13px", color: "var(--t3)", pointerEvents: "none" }}>$</span>
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    style={{ paddingLeft: "24px" }}
                    placeholder="0.00"
                  />
                </div>
                <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "4px" }}>
                  Vacío = suma de cotizaciones seleccionadas
                </p>
              </div>

              {/* Variants */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
                  Variantes
                </label>
                {variants.length > 0 && (
                  <div className="flex flex-col gap-2 mb-2">
                    {variants.map((v) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={v.label}
                          onChange={(e) => updateVariant(v.id, "label", e.target.value)}
                          placeholder="Ej: Chico, Grande, Con base..."
                          className="field-input flex-1"
                          style={{ fontSize: "13px" }}
                        />
                        <div className="relative" style={{ width: "110px", flexShrink: 0 }}>
                          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "var(--t3)", pointerEvents: "none" }}>$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={v.price}
                            onChange={(e) => updateVariant(v.id, "price", e.target.value)}
                            placeholder="0.00"
                            className="field-input"
                            style={{ paddingLeft: "22px", fontSize: "13px" }}
                          />
                        </div>
                        <button type="button" onClick={() => removeVariant(v.id)} style={{ color: "var(--t3)", flexShrink: 0 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={addVariant}
                  className="flex items-center gap-1.5"
                  style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}
                >
                  <Plus size={13} /> Agregar variante
                </button>
              </div>

              {/* Quote picker */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
                  Cotizaciones incluidas *
                  {selectedQuoteIds.length > 1 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}>
                      COMBO
                    </span>
                  )}
                </label>
                {allQuotes.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--t3)" }}>
                    No hay cotizaciones guardadas. Creá una desde la calculadora.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1" style={{ maxHeight: "160px", overflowY: "auto" }}>
                    {allQuotes.map((q) => {
                      const selected = selectedQuoteIds.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => toggleQuote(q.id)}
                          className="flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors"
                          style={{
                            background: selected ? "var(--accent-bg)" : "var(--page-bg)",
                            border: `1px solid ${selected ? "var(--accent-border)" : "var(--border)"}`,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                              style={{
                                background: selected ? "var(--accent)" : "transparent",
                                border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                              }}
                            >
                              {selected && <span style={{ color: "white", fontSize: "10px", lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: "13px", color: "var(--t1)" }}>{q.name}</span>
                          </div>
                          {q.salePrice != null && (
                            <span style={{ fontSize: "12px", color: "var(--t3)", fontVariantNumeric: "tabular-nums" }}>
                              $ {q.salePrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedQuoteIds.length === 0 && allQuotes.length > 0 && (
                  <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "4px" }}>
                    Seleccioná al menos una cotización
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2 rounded-md text-sm font-medium"
                  style={{ background: "var(--page-bg)", color: "var(--t2)", border: "1px solid var(--border)" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim() || selectedQuoteIds.length === 0}
                  className="flex-1 btn-primary py-2 text-sm"
                  style={{ width: "auto" }}
                >
                  {loading ? "Creando..." : "Crear producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
