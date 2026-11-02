"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FilamentSpool } from "./filament-spool";
import { EditFilamentModal } from "./edit-filament-modal";
import type { Filament } from "@prisma/client";

type FilamentWithCount = Filament & { _count: { printJobs: number } };

export function FilamentList({ filaments }: { filaments: FilamentWithCount[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleDelete(id: number) {
    setDeleting(id);
    await fetch(`/api/filaments/${id}`, { method: "DELETE" });
    router.refresh();
    setDeleting(null);
  }

  if (filaments.length === 0) {
    return (
      <div
        className="card flex flex-col items-center justify-center py-16 text-center"
        style={{ color: "var(--t3)" }}
      >
        <p style={{ fontWeight: 500, color: "var(--t2)", marginBottom: "4px" }}>
          Sin filamentos cargados
        </p>
        <p style={{ fontSize: "13px" }}>
          Agregá tu primer spool usando el botón de arriba.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
    >
      {filaments.map((f) => {
        const pct = Math.round((f.currentWeight / f.initialWeight) * 100);
        const isCritical = f.currentWeight < 100;
        const isLow = f.currentWeight < 200;
        const barColor = isCritical
          ? "var(--danger)"
          : isLow
          ? "var(--warning)"
          : "var(--success)";

        return (
          <div key={f.id} className="card overflow-hidden flex flex-col">
            {/* Spool visual */}
            <div
              className="flex items-center justify-center py-6"
              style={{ background: "var(--page-bg)", borderBottom: "1px solid var(--border-subtle)" }}
            >
              <FilamentSpool colorHex={f.colorHex} pct={pct} size={80} />
            </div>

            {/* Info */}
            <div className="flex flex-col flex-1 px-4 py-3 gap-2">
              {/* Brand + material */}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)", letterSpacing: "-0.01em" }}>
                    {f.brand}
                  </span>
                  <span
                    className="px-2 py-px rounded-full"
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      background: "var(--page-bg)",
                      color: "var(--t3)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {f.material}
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--t2)", marginTop: "2px" }}>{f.color}</p>
              </div>

              {/* Status badge */}
              {isLow && (
                <span
                  className="self-start px-2 py-px rounded-full"
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    background: isCritical ? "var(--danger-bg)" : "var(--warning-bg)",
                    color: isCritical ? "var(--danger)" : "var(--warning)",
                  }}
                >
                  {isCritical ? "Crítico" : "Bajo"}
                </span>
              )}

              {/* Progress bar */}
              <div className="mt-auto pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="num-tabular" style={{ fontSize: "11px", color: "var(--t3)" }}>
                    {f.currentWeight}g
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--t3)" }}>{pct}%</span>
                </div>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: "4px", background: "var(--border-subtle)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: barColor,
                      transition: "width 500ms var(--ease-out)",
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div
                className="flex items-center justify-between pt-2"
                style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "4px" }}
              >
                <span className="num-tabular" style={{ fontSize: "11px", color: "var(--t3)" }}>
                  {f._count.printJobs} {f._count.printJobs === 1 ? "print" : "prints"}
                </span>
                <div className="flex items-center gap-0.5">
                  <EditFilamentModal filament={f} />
                  <button
                    onClick={() => handleDelete(f.id)}
                    disabled={deleting === f.id}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: "var(--t3)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--danger-bg)";
                      (e.currentTarget as HTMLElement).style.color = "var(--danger)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--t3)";
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
