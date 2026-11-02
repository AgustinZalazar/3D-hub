"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Bot, User } from "lucide-react";
import type { Issue, PrintJob } from "@prisma/client";

type IssueWithJob = Issue & { printJob: Pick<PrintJob, "fileName"> | null };

const STATUS_NEXT: Record<string, string> = {
  open: "tracking",
  tracking: "resolved",
  resolved: "open",
};

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  open:     { label: "Abierto",       bg: "var(--danger-bg)",  color: "var(--danger)"  },
  tracking: { label: "Seguimiento",   bg: "var(--warning-bg)", color: "var(--warning)" },
  resolved: { label: "Resuelto",      bg: "var(--page-bg)",    color: "var(--t3)"      },
};

const SEVERITY_COLOR: Record<string, string> = {
  error:   "var(--danger)",
  warning: "var(--warning)",
  info:    "var(--accent)",
};

export function IssueList({ issues }: { issues: IssueWithJob[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  async function cycleStatus(issue: IssueWithJob) {
    setUpdating(issue.id);
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: STATUS_NEXT[issue.status] }),
    });
    router.refresh();
    setUpdating(null);
  }

  if (issues.length === 0) {
    return (
      <div
        className="card flex flex-col items-center justify-center py-16 text-center"
        style={{ color: "var(--t3)" }}
      >
        <p style={{ fontWeight: 500, color: "var(--t2)", marginBottom: "4px" }}>
          Sin issues registrados
        </p>
        <p style={{ fontSize: "13px" }}>
          Los errores de la impresora aparecen aquí automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => {
        const st = STATUS_META[issue.status];
        const isOpen = expanded === issue.id;
        const hasDetail = !!(issue.description || issue.printJob);

        return (
          <div key={issue.id} className="card overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-3">
              {/* Severity dot */}
              <span
                className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: SEVERITY_COLOR[issue.severity] ?? "var(--border)" }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontWeight: 500, color: "var(--t1)" }}>{issue.title}</span>

                  <span
                    className="px-2.5 py-0.5 rounded-full"
                    style={{ fontSize: "11px", fontWeight: 500, background: st.bg, color: st.color }}
                  >
                    {st.label}
                  </span>

                  <span
                    className="flex items-center gap-1"
                    style={{ fontSize: "11px", color: "var(--t3)" }}
                  >
                    {issue.type === "hms"
                      ? <><Bot size={11} /> Impresora</>
                      : <><User size={11} /> Manual</>
                    }
                  </span>
                </div>

                <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "3px" }}>
                  {new Date(issue.createdAt).toLocaleDateString("es-AR", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                  {issue.code && (
                    <span style={{ fontFamily: "monospace", marginLeft: "8px" }}>
                      {issue.code}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => cycleStatus(issue)}
                  disabled={updating === issue.id}
                  className="rounded-md px-2.5 py-1.5 transition-colors"
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--t2)",
                    background: "var(--page-bg)",
                    border: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--accent-text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--t2)";
                  }}
                >
                  {updating === issue.id
                    ? "..."
                    : `→ ${STATUS_META[STATUS_NEXT[issue.status]].label}`}
                </button>

                {hasDetail && (
                  <button
                    onClick={() => setExpanded(isOpen ? null : issue.id)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: "var(--t3)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--page-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
            </div>

            {isOpen && hasDetail && (
              <div
                className="px-5 pb-4 space-y-2"
                style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}
              >
                {issue.description && (
                  <p style={{ fontSize: "13px", color: "var(--t2)" }}>{issue.description}</p>
                )}
                {issue.printJob && (
                  <p style={{ fontSize: "12px", color: "var(--t3)" }}>
                    Print:{" "}
                    <span style={{ color: "var(--t2)", fontWeight: 500 }}>
                      {issue.printJob.fileName}
                    </span>
                  </p>
                )}
                {issue.resolvedAt && (
                  <p style={{ fontSize: "12px", color: "var(--t3)" }}>
                    Resuelto el{" "}
                    {new Date(issue.resolvedAt).toLocaleDateString("es-AR", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
