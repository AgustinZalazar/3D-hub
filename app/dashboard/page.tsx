import { prisma } from "@/lib/db/client";
import { Clock, Printer, Package, AlertTriangle } from "lucide-react";
import { PrintStatusCard } from "@/components/dashboard/print-status-card";

async function getStats() {
  const [totalJobs, completedJobs, filaments, openIssues, durationAgg] = await Promise.all([
    prisma.printJob.count(),
    prisma.printJob.count({ where: { status: "completed" } }),
    prisma.filament.findMany({ where: { isActive: true } }),
    prisma.issue.count({ where: { status: "open" } }),
    prisma.printJob.aggregate({
      _sum: { durationSeconds: true },
      where: { status: "completed" },
    }),
  ]);

  const totalHours = Math.round((durationAgg._sum.durationSeconds ?? 0) / 3600);
  const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : null;
  const lowFilaments = filaments.filter((f) => f.currentWeight < 200);

  return { totalHours, totalJobs, completedJobs, successRate, filaments, lowFilaments, openIssues };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p style={{ fontSize: "13px", color: "var(--t3)", marginBottom: "4px" }}>
          {greeting()}
        </p>
        <h1
          className="font-semibold tracking-tight"
          style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}
        >
          Dashboard
        </h1>
      </div>

      {/* Active print */}
      <PrintStatusCard />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Horas de impresión"
          value={stats.totalHours}
          suffix="h"
          sub="tiempo total acumulado"
        />
        <StatCard
          icon={Printer}
          label="Prints completados"
          value={stats.completedJobs}
          sub={stats.successRate !== null ? `${stats.successRate}% de éxito` : "sin registros aún"}
        />
        <StatCard
          icon={Package}
          label="Filamentos"
          value={stats.filaments.length}
          sub={
            stats.lowFilaments.length > 0
              ? `${stats.lowFilaments.length} con stock bajo`
              : "todo en orden"
          }
          warn={stats.lowFilaments.length > 0}
        />
        <StatCard
          icon={AlertTriangle}
          label="Issues abiertos"
          value={stats.openIssues}
          sub={stats.openIssues === 0 ? "sin problemas activos" : "requieren atención"}
          warn={stats.openIssues > 0}
        />
      </div>

      {/* Low stock alerts */}
      {stats.lowFilaments.length > 0 && (
        <section>
          <p
            className="font-medium mb-3"
            style={{ fontSize: "13px", color: "var(--t2)" }}
          >
            Filamentos con stock bajo
          </p>
          <div className="space-y-2">
            {stats.lowFilaments.map((f) => {
              const pct = Math.round((f.currentWeight / f.initialWeight) * 100);
              const isCritical = f.currentWeight < 100;
              return (
                <div
                  key={f.id}
                  className="card flex items-center gap-4 px-5 py-4"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      background: f.colorHex ?? "var(--border)",
                      border: "1.5px solid var(--border)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontWeight: 500, color: "var(--t1)" }}>
                      {f.brand} {f.material} — {f.color}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div
                        className="flex-1 rounded-full overflow-hidden"
                        style={{ height: "4px", background: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: isCritical ? "var(--danger)" : "var(--warning)",
                          }}
                        />
                      </div>
                      <span
                        className="num-tabular flex-shrink-0"
                        style={{ fontSize: "12px", color: "var(--t3)" }}
                      >
                        {f.currentWeight}g
                      </span>
                    </div>
                  </div>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style={{
                      background: isCritical ? "var(--danger-bg)" : "var(--warning-bg)",
                      color: isCritical ? "var(--danger)" : "var(--warning)",
                    }}
                  >
                    {isCritical ? "Crítico" : "Bajo"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state when everything is clean */}
      {stats.lowFilaments.length === 0 && stats.openIssues === 0 && stats.totalJobs === 0 && (
        <div
          className="card flex flex-col items-center justify-center py-16 text-center"
          style={{ color: "var(--t3)" }}
        >
          <Printer size={32} strokeWidth={1.2} style={{ marginBottom: "12px", color: "var(--border)" }} />
          <p style={{ fontWeight: 500, color: "var(--t2)", marginBottom: "4px" }}>
            Todo listo para arrancar
          </p>
          <p style={{ fontSize: "13px" }}>
            Cargá tus filamentos y conectá la impresora para empezar a registrar prints.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  sub,
  warn = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="card px-5 py-5">
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </p>
        <Icon
          size={14}
          strokeWidth={1.8}
          style={{ color: warn && value > 0 ? "var(--warning)" : "var(--border)" }}
        />
      </div>
      <p
        className="num-tabular"
        style={{
          fontSize: "36px",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: warn && value > 0 ? "var(--warning)" : "var(--t1)",
        }}
      >
        {value}<span style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "-0.02em" }}>{suffix}</span>
      </p>
      {sub && (
        <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "6px" }}>{sub}</p>
      )}
    </div>
  );
}
