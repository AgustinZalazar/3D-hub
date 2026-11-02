"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SEVERITIES = [
  { value: "error",   label: "Error",   bg: "var(--danger-bg)",  color: "var(--danger)",  border: "var(--danger)"  },
  { value: "warning", label: "Warning", bg: "var(--warning-bg)", color: "var(--warning)", border: "var(--warning)" },
  { value: "info",    label: "Info",    bg: "var(--accent-bg)",  color: "var(--accent)",  border: "var(--accent)"  },
] as const;

export function AddIssueForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "warning" });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ title: "", description: "", severity: "warning" });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="card p-5">
      <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)", marginBottom: "16px", letterSpacing: "-0.01em" }}>
        Registrar issue
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", marginBottom: "8px" }}>
            Severidad
          </p>
          <div className="flex gap-2">
            {SEVERITIES.map((s) => {
              const active = form.severity === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set("severity", s.value)}
                  className="flex-1 py-1.5 rounded-lg transition-colors"
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    border: `1px solid ${active ? s.border : "var(--border)"}`,
                    background: active ? s.bg : "transparent",
                    color: active ? s.color : "var(--t3)",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
            Título
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Descripción corta del problema"
            required
            className="field-input"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between" style={{ marginBottom: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)" }}>Detalle</label>
            <span style={{ fontSize: "11px", color: "var(--t3)" }}>opcional</span>
          </div>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Contexto adicional, pasos para reproducir..."
            rows={3}
            className="field-input"
            style={{ resize: "none", lineHeight: 1.5 }}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: "4px" }}>
          {loading ? "Guardando..." : "Registrar issue"}
        </button>
      </form>
    </div>
  );
}
