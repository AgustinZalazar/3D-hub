"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function PrinterProfileCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    wattage: "65",
    kwHPrice: "",
    lifeHours: "5000",
    partsPrice: "",
    errorMarginPct: "15",
    isDefault: false,
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/printer-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", wattage: "65", kwHPrice: "", lifeHours: "5000", partsPrice: "", errorMarginPct: "15", isDefault: false });
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 btn-primary"
        style={{ fontSize: "13px" }}
      >
        <Plus size={14} /> Nuevo perfil
      </button>
    );
  }

  return (
    <div className="card p-5">
      <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)", marginBottom: "16px", letterSpacing: "-0.01em" }}>
        Nuevo perfil de impresora
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Bambu A1 Mini, Ender 3..."
            required
            className="field-input"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Consumo real" unit="W">
            <NumInput value={form.wattage} onChange={(v) => set("wattage", v)} unit="W" />
          </Field>
          <Field label="Precio kWh" unit="$">
            <NumInput value={form.kwHPrice} onChange={(v) => set("kwHPrice", v)} unit="$" />
          </Field>
          <Field label="Vida útil" unit="h">
            <NumInput value={form.lifeHours} onChange={(v) => set("lifeHours", v)} unit="h" />
          </Field>
          <Field label="Precio repuestos" unit="$">
            <NumInput value={form.partsPrice} onChange={(v) => set("partsPrice", v)} unit="$" />
          </Field>
          <div className="col-span-2">
            <Field label="Margen de error" unit="%">
              <NumInput value={form.errorMarginPct} onChange={(v) => set("errorMarginPct", v)} unit="%" />
            </Field>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: "13px", color: "var(--t2)" }}>
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => set("isDefault", e.target.checked)}
            className="rounded"
          />
          Usar como perfil por defecto
        </label>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Guardando..." : "Crear perfil"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: "var(--t2)", background: "var(--page-bg)", border: "1px solid var(--border)" }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "5px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, unit }: { value: string; onChange: (v: string) => void; unit: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        min="0"
        step="any"
        className="field-input"
        style={{ paddingRight: unit.length > 1 ? "36px" : "28px" }}
      />
      <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "var(--t3)", pointerEvents: "none" }}>
        {unit}
      </span>
    </div>
  );
}
