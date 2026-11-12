"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, X, Upload, Image as ImageIcon } from "lucide-react";

interface Quote {
  id: number;
  name: string;
  salePrice: number | null;
}

interface Props {
  quote: Quote;
}

export function PublishToCatalogModal({ quote }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(quote.name);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(quote.salePrice?.toFixed(2) ?? "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function openModal() {
    setName(quote.name);
    setDescription("");
    setPrice(quote.salePrice?.toFixed(2) ?? "");
    setPhotoPreview(null);
    setPhotoFile(null);
    setOpen(true);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        quoteIds: [quote.id],
      }),
    });

    setLoading(false);
    setOpen(false);
    router.push("/catalog");
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="p-1.5 rounded-md transition-colors flex-shrink-0"
        style={{ color: "var(--t3)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t3)")}
        title="Publicar en catálogo"
      >
        <BookMarked size={14} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 0.45)", animation: "backdrop-in 150ms ease" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="card w-full max-w-md"
            style={{ animation: "modal-in 200ms var(--ease-out)", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontWeight: 600, fontSize: "15px", color: "var(--t1)" }}>
                Publicar en catálogo
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md"
                style={{ color: "var(--t3)" }}
              >
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
                  style={{
                    height: "160px",
                    border: "2px dashed var(--border)",
                    background: "var(--page-bg)",
                  }}
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
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>

              {/* Name */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
                  Nombre del producto *
                </label>
                <input
                  className="field-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ej: Soporte de pared"
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
                  placeholder="Descripción del producto, materiales, dimensiones..."
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
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ fontSize: "13px", color: "var(--t3)", pointerEvents: "none" }}
                  >
                    $
                  </span>
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
                {quote.salePrice != null && (
                  <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "4px" }}>
                    Calculado: $ {quote.salePrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity"
                  style={{ background: "var(--page-bg)", color: "var(--t2)", border: "1px solid var(--border)" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1 btn-primary py-2 text-sm"
                  style={{ width: "auto" }}
                >
                  {loading ? "Publicando..." : "Publicar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
