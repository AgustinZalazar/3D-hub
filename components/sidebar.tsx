"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, AlertTriangle, Layers, Box, Calculator, ShoppingBag } from "lucide-react";

const nav = [
  { href: "/dashboard",   label: "Dashboard",    icon: LayoutDashboard },
  { href: "/filaments",   label: "Filamentos",   icon: Package },
  { href: "/models",      label: "Modelos",      icon: Box },
  { href: "/calculator",  label: "Calculadora",  icon: Calculator },
  { href: "/products",    label: "Productos",    icon: ShoppingBag },
  { href: "/issues",      label: "Issues",       icon: AlertTriangle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-56 flex flex-col"
      style={{
        background: "var(--card-bg)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Layers size={14} strokeWidth={2.2} />
        </div>
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: "15px", color: "var(--t1)", letterSpacing: "-0.01em" }}
        >
          3D Hub
        </span>
      </div>

      <div className="mx-4" style={{ height: "1px", background: "var(--border-subtle)" }} />

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: active ? "var(--accent-text)" : "var(--t2)",
                background: active ? "var(--accent-bg)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "var(--page-bg)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2.2 : 1.8}
                style={{ color: active ? "var(--accent)" : "var(--t3)" }}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--page-bg)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--success)" }}
          />
          <div className="min-w-0">
            <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)" }}>
              Bambu A1 Mini
            </p>
            <p style={{ fontSize: "11px", color: "var(--t3)" }}>Local — LAN</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
