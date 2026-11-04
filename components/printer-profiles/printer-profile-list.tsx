"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Star, X, Check } from "lucide-react";
import type { PrinterProfile } from "@prisma/client";

export function PrinterProfileList({ profiles }: { profiles: PrinterProfile[] }) {
  return (
    <div className="space-y-2">
      {profiles.map((p) => (
        <ProfileRow key={p.id} profile={p} />
      ))}
    </div>
  );
}

function ProfileRow({ profile }: { profile: PrinterProfile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: profile.name,
    wattage: String(profile.wattage),
    kwHPrice: String(profile.kwHPrice),
    lifeHours: String(profile.lifeHours),
    partsPrice: String(profile.partsPrice),
    errorMarginPct: String(profile.errorMarginPct),
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setLoading(true);
    await fetch(`/api/printer-profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  async function setDefault() {
    setLoading(true);
    await fetch(`/api/printer-profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setLoading(false);
    router.refresh();
  }

  async function deleteProfile() {
    if (!confirm(`¿Eliminar el perfil "${profile.name}"?`)) return;
    setLoading(true);
    await fetch(`/api/printer-profiles/${profile.id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="field-input"
            style={{ fontWeight: 600, fontSize: "14px" }}
            autoFocus
          />
          <div className="flex gap-1 ml-2">
            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: "var(--success)", background: "var(--success-bg)" }}
              title="Guardar"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: "var(--t3)" }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Consumo", field: "wattage", unit: "W" },
            { label: "kWh precio", field: "kwHPrice", unit: "$" },
            { label: "Vida útil", field: "lifeHours", unit: "h" },
            { label: "Repuestos", field: "partsPrice", unit: "$" },
            { label: "Error", field: "errorMarginPct", unit: "%" },
          ].map(({ label, field, unit }) => (
            <div key={field}>
              <label style={{ fontSize: "11px", color: "var(--t3)", display: "block", marginBottom: "3px" }}>{label}</label>
              <div className="relative">
                <input
                  type="number"
                  value={form[field as keyof typeof form]}
                  onChange={(e) => set(field, e.target.value)}
                  min="0"
                  step="any"
                  className="field-input"
                  style={{ fontSize: "12px", paddingRight: unit.length > 1 ? "32px" : "24px" }}
                />
                <span style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", color: "var(--t3)", pointerEvents: "none" }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)" }}>{profile.name}</p>
          {profile.isDefault && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-bg)", color: "var(--accent)", fontSize: "11px", fontWeight: 500 }}
            >
              <Star size={9} fill="currentColor" /> default
            </span>
          )}
        </div>
        <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
          {profile.wattage}W · ${profile.kwHPrice}/kWh · {profile.lifeHours}h vida útil · ${profile.partsPrice} repuestos · {profile.errorMarginPct}% error
        </p>
      </div>

      <div className="flex items-center gap-1">
        {!profile.isDefault && (
          <button
            type="button"
            onClick={setDefault}
            disabled={loading}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "var(--t3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t3)")}
            title="Marcar como default"
          >
            <Star size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
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
          onClick={deleteProfile}
          disabled={loading}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--t3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t3)")}
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
