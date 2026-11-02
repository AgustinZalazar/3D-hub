"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "ASA", "PA", "PC", "PLA-CF", "PETG-CF"];

export function AddFilamentForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    brand: "",
    material: "PLA",
    color: "",
    colorHex: "#22c55e",
    initialWeight: "1000",
    currentWeight: "",
    spoolWeight: "200",
    notes: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/filaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ brand: "", material: "PLA", color: "", colorHex: "#22c55e", initialWeight: "1000", currentWeight: "", spoolWeight: "200", notes: "" });
    router.refresh();
    setLoading(false);
    onSuccess?.();
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
        <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)", letterSpacing: "-0.01em" }}>
          Agregar filamento
        </p>
        {onSuccess && (
          <button
            type="button"
            onClick={onSuccess}
            className="p-1 rounded-md transition-colors"
            style={{ color: "var(--t3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--page-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Marca">
          <input
            type="text"
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="Bambu, eSUN, Polymaker..."
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
              placeholder="Blanco, Galaxy Black..."
              required
              className="field-input"
              style={{ flex: 1 }}
            />
            <label
              className="flex-shrink-0 w-9 h-9 rounded-lg cursor-pointer overflow-hidden"
              style={{ border: "1.5px solid var(--border)", position: "relative" }}
            >
              <span
                className="absolute inset-0"
                style={{ background: form.colorHex }}
              />
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
          <Field label="Peso inicial" hint="spool nuevo">
            <input
              type="number"
              value={form.initialWeight}
              onChange={(e) => {
                set("initialWeight", e.target.value);
                if (!form.currentWeight) set("currentWeight", e.target.value);
              }}
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
              placeholder={form.initialWeight}
              min="0"
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
          {loading ? "Guardando..." : "Agregar filamento"}
        </button>
      </form>
    </div>
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
