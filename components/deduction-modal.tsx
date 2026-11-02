"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Item = {
  colorHex: string;
  grams: number;
  filamentId: number | null;
  filamentLabel: string;
  editable?: boolean;
};

type Pending = {
  jobId: number;
  fileName: string;
  items: Item[];
};

function cleanFileName(name: string) {
  return name.replace(/\.gcode(\.3mf)?$/i, "").replace(/_/g, " ");
}

export function DeductionModal() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [editGrams, setEditGrams] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/deductions/pending");
        if (!res.ok) return;
        const text = await res.text();
        if (!text) return;
        setPending(JSON.parse(text));
      } catch {
        // ignore network/parse errors
      }
    };
    poll();
    const interval = setInterval(poll, 6000);
    return () => clearInterval(interval);
  }, []);

  async function act(action: "confirm" | "cancel") {
    if (!pending) return;
    setLoading(action);
    // Merge edited gram values back into items
    const items = pending.items.map((item, i) =>
      item.editable && editGrams[i] !== undefined
        ? { ...item, grams: parseFloat(editGrams[i]) || 0 }
        : item
    );
    await fetch(`/api/deductions/${pending.jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, items }),
    });
    setPending(null);
    setLoading(null);
    router.refresh();
  }

  if (!pending) return null;

  const hasEditable = pending.items.some((i) => i.editable);
  const totalGrams = pending.items.reduce((s, i) => s + i.grams, 0);
  const hasUnmatched = pending.items.some((i) => !i.filamentId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ animation: "backdrop-in 150ms var(--ease-out)" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "oklch(0.145 0.015 265 / 0.35)", backdropFilter: "blur(3px)" }}
      />

      <div
        className="relative card p-6 w-full"
        style={{ maxWidth: "420px", animation: "modal-in 220ms var(--ease-out)" }}
      >
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            Print completado
          </p>
          <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.015em" }}>
            {cleanFileName(pending.fileName)}
          </p>
          <p style={{ fontSize: "13px", color: "var(--t3)", marginTop: "2px" }}>
            {totalGrams.toFixed(1)}g total · ¿Descontamos del stock?
          </p>
        </div>

        {/* Items */}
        <div className="space-y-2" style={{ marginBottom: "20px" }}>
          {hasEditable && (
            <p style={{ fontSize: "12px", color: "var(--t3)", marginBottom: "8px" }}>
              No se detectó el consumo automáticamente. Ingresá cuánto usaste de cada filamento.
            </p>
          )}
          {pending.items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg px-4 py-3"
              style={{
                background: item.filamentId ? "var(--page-bg)" : "var(--warning-bg)",
                border: `1px solid ${item.filamentId ? "var(--border-subtle)" : "oklch(0.820 0.060 62)"}`,
              }}
            >
              <span
                className="flex-shrink-0 rounded-full"
                style={{ width: "28px", height: "28px", background: item.colorHex, border: "2px solid var(--border)", boxShadow: "inset 0 0 0 1px oklch(0 0 0 / 0.08)" }}
              />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--t1)" }}>{item.filamentLabel}</p>
                <p style={{ fontSize: "11px", color: "var(--t3)" }}>{item.colorHex}</p>
              </div>
              {item.editable ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={editGrams[i] ?? ""}
                    onChange={(e) => setEditGrams((prev) => ({ ...prev, [i]: e.target.value }))}
                    className="field-input num-tabular"
                    style={{ width: "64px", padding: "4px 8px", fontSize: "13px", textAlign: "right" }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--t3)" }}>g</span>
                </div>
              ) : (
                <span className="num-tabular flex-shrink-0 font-semibold" style={{ fontSize: "14px", color: item.filamentId ? "var(--t1)" : "var(--warning)" }}>
                  -{item.grams.toFixed(1)}g
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Warning if unmatched */}
        {hasUnmatched && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-5"
            style={{ background: "var(--warning-bg)", border: "1px solid oklch(0.820 0.060 62)" }}
          >
            <AlertTriangle size={13} style={{ color: "var(--warning)", marginTop: "1px", flexShrink: 0 }} />
            <p style={{ fontSize: "12px", color: "var(--warning)" }}>
              Algunos colores no tienen filamento asignado en tu stock y no se descontarán.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => act("cancel")}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg font-medium"
            style={{
              padding: "9px 16px",
              fontSize: "14px",
              background: "var(--page-bg)",
              color: "var(--t2)",
              border: "1px solid var(--border)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading === "cancel" ? 0.5 : 1,
            }}
          >
            <XCircle size={15} strokeWidth={1.8} />
            No descontar
          </button>
          <button
            onClick={() => act("confirm")}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg font-medium"
            style={{
              padding: "9px 16px",
              fontSize: "14px",
              background: "var(--accent)",
              color: "oklch(0.98 0.004 288)",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading === "confirm" ? 0.5 : 1,
            }}
          >
            <CheckCircle2 size={15} strokeWidth={1.8} />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
