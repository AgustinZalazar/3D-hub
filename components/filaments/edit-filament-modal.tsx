"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";
import type { Filament } from "@prisma/client";

const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "ASA", "PA", "PC", "PLA-CF", "PETG-CF"];

export function EditFilamentModal({ filament }: { filament: Filament }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    brand:         filament.brand,
    material:      filament.material,
    color:         filament.color,
    colorHex:      filament.colorHex ?? "#22c55e",
    initialWeight: String(filament.initialWeight),
    currentWeight: String(filament.currentWeight),
    spoolWeight:   String(filament.spoolWeight),
    pricePerKg:    filament.pricePerKg != null ? String(filament.pricePerKg) : "",
    notes:         filament.notes ?? "",
  });

  useEffect(() => {
    if (!isOpen) return;
    // Reset form to current filament values when opening
    setForm({
      brand:         filament.brand,
      material:      filament.material,
      color:         filament.color,
      colorHex:      filament.colorHex ?? "#22c55e",
      initialWeight: String(filament.initialWeight),
      currentWeight: String(filament.currentWeight),
      spoolWeight:   String(filament.spoolWeight),
      pricePerKg:    filament.pricePerKg != null ? String(filament.pricePerKg) : "",
      notes:         filament.notes ?? "",
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, filament]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch(`/api/filaments/${filament.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    router.refresh();
    setLoading(false);
    setIsOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 rounded-md transition-colors"
        style={{ color: "var(--t3)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--page-bg)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        title="Editar filamento"
      >
        <Pencil size={14} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ animation: "backdrop-in 150ms var(--ease-out)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "oklch(0.145 0.015 265 / 0.30)", backdropFilter: "blur(2px)" }}
          />
          <div
            className="relative w-full"
            style={{ maxWidth: "440px", animation: "modal-in 200ms var(--ease-out)" }}
          >
            <div className="card p-5">
              <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
                <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)", letterSpacing: "-0.01em" }}>
                  Editar filamento
                </p>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md transition-colors"
                  style={{ color: "var(--t3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--page-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Marca">
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    required
                    className="field-input"
                  />
                </Field>

                <Field label="Material">
                  <select
                    value={form.material}
                    onChange={(e) => set("material", e.target.value)}
                    className="field-input"
                    style={{ cursor: "pointer" }}
                  >
                    {MATERIALS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Color">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={form.color}
                      onChange={(e) => set("color", e.target.value)}
                      required
                      className="field-input"
                      style={{ flex: 1 }}
                    />
                    <label
                      className="flex-shrink-0 w-9 h-9 rounded-lg cursor-pointer overflow-hidden"
                      style={{ border: "1.5px solid var(--border)", position: "relative" }}
                    >
                      <span className="absolute inset-0" style={{ background: form.colorHex }} />
                      <input
                        type="color"
                        value={form.colorHex}
                        onChange={(e) => set("colorHex", e.target.value)}
                        style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer" }}
                      />
                    </label>
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Peso inicial">
                    <input
                      type="number"
                      value={form.initialWeight}
                      onChange={(e) => set("initialWeight", e.target.value)}
                      min="1"
                      required
                      className="field-input"
                    />
                  </Field>
                  <Field label="Peso actual" hint="pesalo">
                    <input
                      type="number"
                      value={form.currentWeight}
                      onChange={(e) => set("currentWeight", e.target.value)}
                      min="0"
                      required
                      className="field-input"
                    />
                  </Field>
                </div>

                <Field label="Peso spool vacío">
                  <input
                    type="number"
                    value={form.spoolWeight}
                    onChange={(e) => set("spoolWeight", e.target.value)}
                    min="0"
                    className="field-input"
                  />
                </Field>

                <Field label="Precio por kg" hint="opcional">
                  <div className="relative">
                    <input
                      type="number"
                      value={form.pricePerKg}
                      onChange={(e) => set("pricePerKg", e.target.value)}
                      placeholder="0"
                      min="0"
                      step="any"
                      className="field-input"
                      style={{ paddingRight: "42px" }}
                    />
                    <span
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ fontSize: "12px", color: "var(--t3)", pointerEvents: "none" }}
                    >
                      $/kg
                    </span>
                  </div>
                </Field>

                <Field label="Notas">
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Opcional"
                    className="field-input"
                  />
                </Field>

                <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: "4px" }}>
                  {loading ? "Guardando..." : "Guardar cambios"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between" style={{ marginBottom: "6px" }}>
        <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)" }}>{label}</label>
        {hint && <span style={{ fontSize: "11px", color: "var(--t3)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
