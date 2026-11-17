"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, X, Check, Trash2, ShoppingBag, ChevronDown, CheckCircle } from "lucide-react";
import Link from "next/link";

type SaleItem = { name: string; quantity: number; unitPrice: number; colorVariant?: string; catalogItemId?: number };

type CatalogOption = {
  id: number;
  name: string;
  price: number | null;
  colorVariants: string | null;
  entries: { quote: { salePrice: number | null; salePriceWithFee: number | null } }[];
};

type ClientRef = { id: number; name: string };

type Sale = {
  id: number;
  clientId: number;
  client: ClientRef;
  status: string;
  items: string;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

const STATUSES = [
  { value: "presupuestado", label: "Presupuestado", color: "var(--t3)",  bg: "var(--page-bg)" },
  { value: "confirmado",    label: "Confirmado",    color: "#2563eb",    bg: "#dbeafe" },
  { value: "en_produccion", label: "En producción", color: "#7c3aed",    bg: "#ede9fe" },
  { value: "listo",         label: "Listo",         color: "#d97706",    bg: "#fef3c7" },
  { value: "entregado",     label: "Entregado",     color: "#16a34a",    bg: "#dcfce7" },
  { value: "cancelado",     label: "Cancelado",     color: "#dc2626",    bg: "#fee2e2" },
];

const STATUS_ACTIVE = ["presupuestado", "confirmado", "en_produccion", "listo"];

function statusMeta(v: string) { return STATUSES.find((s) => s.value === v) ?? STATUSES[1]; }
function fmt(n: number) { return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }); }
function parseItems(raw: string): SaleItem[] { try { return JSON.parse(raw); } catch { return []; } }

function catalogItemPrice(item: CatalogOption): number {
  if (item.price != null) return item.price;
  const prices = item.entries.map((e) => e.quote.salePriceWithFee ?? e.quote.salePrice ?? 0).filter((p) => p > 0);
  return prices.length > 0 ? Math.max(...prices) : 0;
}

type CatalogRow = { catalogItemId: number; name: string; price: number; colorVariant?: string };

function buildCatalogRows(catalog: CatalogOption[]): CatalogRow[] {
  const rows: CatalogRow[] = [];
  for (const cat of catalog) {
    const basePrice = catalogItemPrice(cat);
    const variants: { id: string; label: string; price?: number }[] = (() => {
      try { return cat.colorVariants ? JSON.parse(cat.colorVariants) : []; } catch { return []; }
    })();
    if (variants.length === 0) {
      rows.push({ catalogItemId: cat.id, name: cat.name, price: basePrice });
    } else {
      for (const v of variants) {
        rows.push({ catalogItemId: cat.id, name: cat.name, price: v.price ?? basePrice, colorVariant: v.label });
      }
    }
  }
  return rows;
}

// ─── Catalog Autocomplete ────────────────────────────────────────────────────

function CatalogAutocomplete({ catalog, onAdd }: { catalog: CatalogOption[]; onAdd: (row: CatalogRow) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rows = buildCatalogRows(catalog);
  const filtered = query.trim()
    ? rows.filter((r) => `${r.name} ${r.colorVariant ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    : rows;

  function pick(row: CatalogRow) { onAdd(row); setQuery(""); setOpen(false); }

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input w-full"
        placeholder="Buscar producto del catálogo..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ fontSize: "13px" }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100, background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: "220px", overflowY: "auto" }}>
          {filtered.map((row, i) => (
            <button key={i} type="button" onMouseDown={() => pick(row)}
              className="flex items-center justify-between w-full px-3 py-2 text-left"
              style={{ background: "none", border: "none", cursor: "pointer", borderBottom: i < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--page-bg)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
            >
              <div>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--t1)" }}>{row.name}</span>
                {row.colorVariant && <span style={{ fontSize: "12px", color: "var(--t3)", marginLeft: "6px" }}>{row.colorVariant}</span>}
              </div>
              {row.price > 0 && <span style={{ fontSize: "12px", color: "var(--t3)", marginLeft: "12px" }}>{fmt(row.price)}</span>}
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100, background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px" }}>
          <p style={{ fontSize: "12px", color: "var(--t3)" }}>Sin resultados — podés agregarlo como línea manual</p>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge with fixed-position dropdown ──────────────────────────────

function StatusBadge({ sale, onUpdate }: { sale: Sale; onUpdate: (s: Sale) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const meta = statusMeta(sale.status);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.closest("[data-dropdown]")?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function toggle() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownH = STATUSES.length * 36 + 8;
    const top = spaceBelow >= dropdownH ? rect.bottom + 4 : rect.top - dropdownH - 4;
    setPos({ top, left: rect.left });
    setOpen((v) => !v);
  }

  async function changeStatus(value: string) {
    setOpen(false);
    const res = await fetch(`/api/sales/${sale.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: value, deliveredAt: value === "entregado" ? new Date().toISOString() : null }),
    });
    if (res.ok) onUpdate(await res.json());
  }

  return (
    <div data-dropdown="" style={{ position: "relative", display: "inline-block" }}>
      <button ref={btnRef} onClick={toggle}
        className="flex items-center gap-1"
        style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "20px", border: "none", color: meta.color, background: meta.bg, cursor: "pointer" }}>
        {meta.label} <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", minWidth: "160px", padding: "4px" }}>
          {STATUSES.map((s) => (
            <button key={s.value} onClick={() => changeStatus(s.value)}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded text-left"
              style={{ fontSize: "12px", color: s.value === sale.status ? s.color : "var(--t2)", background: "none", border: "none", cursor: "pointer", fontWeight: s.value === sale.status ? 600 : 400 }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--page-bg)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
            >
              {s.value === sale.status && <Check size={12} />}
              <span style={{ marginLeft: s.value === sale.status ? 0 : "16px" }}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Sale Modal ──────────────────────────────────────────────────────────

function NewSaleModal({ clients, catalog, onCreated }: { clients: ClientRef[]; catalog: CatalogOption[]; onCreated: (s: Sale) => void }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<number | "">("");
  const [status, setStatus] = useState("confirmado");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const totalAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function addFromCatalog(row: CatalogRow) {
    const existing = items.findIndex((i) => i.catalogItemId === row.catalogItemId && i.colorVariant === row.colorVariant);
    if (existing >= 0) {
      setItems((prev) => prev.map((it, i) => i === existing ? { ...it, quantity: it.quantity + 1 } : it));
    } else {
      setItems((prev) => [...prev, { name: row.name, quantity: 1, unitPrice: row.price, colorVariant: row.colorVariant, catalogItemId: row.catalogItemId }]);
    }
  }

  function addBlankItem() { setItems((prev) => [...prev, { name: "", quantity: 1, unitPrice: 0 }]); }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof SaleItem, value: string | number) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function resetModal() { setItems([]); setStatus("confirmado"); setPaidAmount(0); setNotes(""); setClientId(""); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) return;
    setLoading(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, status, items: validItems, totalAmount, paidAmount, notes }),
    });
    if (res.ok) { onCreated(await res.json()); setOpen(false); resetModal(); }
    setLoading(false);
  }

  if (!open) {
    return (
      <button className="btn-primary flex items-center gap-2" style={{ fontSize: "13px" }} onClick={() => setOpen(true)}>
        <Plus size={14} /> Nueva venta
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="card p-6 w-full max-w-lg" style={{ background: "var(--card-bg)", maxHeight: "92vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontWeight: 600, fontSize: "16px", color: "var(--t1)" }}>Nueva venta</h2>
          <button onClick={() => { setOpen(false); resetModal(); }}><X size={16} style={{ color: "var(--t3)" }} /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">

          {/* Cliente */}
          <div>
            <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Cliente *</label>
            <select className="input w-full mt-1" value={clientId} onChange={(e) => setClientId(Number(e.target.value))} required style={{ fontSize: "13px" }}>
              <option value="">Seleccioná un cliente...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Estado */}
          <div>
            <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Estado</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {STATUSES.map((s) => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                  style={{ fontSize: "12px", fontWeight: 500, padding: "3px 10px", borderRadius: "20px", border: "none", cursor: "pointer",
                    color: status === s.value ? s.color : "var(--t3)",
                    background: status === s.value ? s.bg : "var(--page-bg)",
                    outline: status === s.value ? `1.5px solid ${s.color}` : "none",
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog search */}
          {catalog.length > 0 && (
            <div>
              <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500, display: "block", marginBottom: "6px" }}>Agregar del catálogo</label>
              <CatalogAutocomplete catalog={catalog} onAdd={addFromCatalog} />
            </div>
          )}

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>
                Productos{items.length > 0 ? ` (${items.length})` : ""}
              </label>
              <button type="button" onClick={addBlankItem}
                style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
                + línea manual
              </button>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", border: "1.5px dashed var(--border)", borderRadius: "8px" }}>
                <p style={{ fontSize: "12px", color: "var(--t3)" }}>Buscá un producto o agregá una línea manual</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <input className="input w-full" placeholder="Nombre" value={it.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)} style={{ fontSize: "13px" }} />
                      {it.colorVariant && <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "2px", paddingLeft: "2px" }}>{it.colorVariant}</p>}
                    </div>
                    <input className="input w-14 text-right" type="number" min={1} value={it.quantity}
                      onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} style={{ fontSize: "13px" }} />
                    <input className="input w-24 text-right" type="number" min={0} value={it.unitPrice || ""}
                      onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                      placeholder="Precio" style={{ fontSize: "13px" }} />
                    <button type="button" onClick={() => removeItem(idx)} style={{ marginTop: "9px" }}>
                      <X size={14} style={{ color: "var(--t3)" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totales */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Total</label>
              <div className="input mt-1" style={{ background: "var(--page-bg)", color: "var(--t1)", fontWeight: 700 }}>{fmt(totalAmount)}</div>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Pagado</label>
              <input className="input w-full mt-1" type="number" min={0} value={paidAmount || ""}
                onChange={(e) => setPaidAmount(Number(e.target.value))} placeholder="0" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Notas</label>
            <textarea className="input w-full mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones..." style={{ resize: "none" }} />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => { setOpen(false); resetModal(); }}>Cancelar</button>
            <button type="submit" className="btn-primary"
              disabled={loading || !clientId || items.filter(i => i.name.trim()).length === 0}>
              {loading ? "Guardando..." : "Crear venta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: "all",          label: "Todas" },
  { value: "active",       label: "En curso" },
  { value: "presupuestado",label: "Presupuestado" },
  { value: "confirmado",   label: "Confirmado" },
  { value: "en_produccion",label: "En producción" },
  { value: "listo",        label: "Listo" },
  { value: "entregado",    label: "Entregado" },
  { value: "cancelado",    label: "Cancelado" },
];

export function VentasClient({
  initialSales,
  clients,
  catalogItems,
}: {
  initialSales: Sale[];
  clients: ClientRef[];
  catalogItems: CatalogOption[];
}) {
  const [sales, setSales] = useState(initialSales);
  const [filter, setFilter] = useState("all");

  const addSale = useCallback((s: Sale) => setSales((prev) => [s, ...prev]), []);
  const updateSale = useCallback((updated: Sale) => setSales((prev) => prev.map((s) => s.id === updated.id ? updated : s)), []);

  async function deleteSale(id: number) {
    if (!confirm("¿Eliminar esta venta?")) return;
    const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
    if (res.ok) setSales((prev) => prev.filter((s) => s.id !== id));
  }

  async function markPaid(sale: Sale) {
    const res = await fetch(`/api/sales/${sale.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paidAmount: sale.totalAmount }),
    });
    if (res.ok) updateSale(await res.json());
  }

  const filtered = sales.filter((s) => {
    if (filter === "all") return true;
    if (filter === "active") return STATUS_ACTIVE.includes(s.status);
    return s.status === filter;
  });

  // Stats
  const totalRevenue  = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalPending  = sales.reduce((acc, s) => acc + (s.totalAmount - s.paidAmount), 0);
  const countActive   = sales.filter((s) => STATUS_ACTIVE.includes(s.status)).length;
  const countDelivered= sales.filter((s) => s.status === "entregado").length;

  // Per-client sale counts for display
  const clientSaleCount: Record<number, number> = {};
  for (const s of sales) {
    if (!STATUS_ACTIVE.includes(s.status) && s.status !== "entregado") continue;
    clientSaleCount[s.clientId] = (clientSaleCount[s.clientId] ?? 0) + 1;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold tracking-tight" style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}>
            Ventas
          </h1>
          <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
            {sales.length} venta{sales.length !== 1 ? "s" : ""} en total
          </p>
        </div>
        <NewSaleModal clients={clients} catalog={catalogItems} onCreated={addSale} />
      </div>

      {/* Stats */}
      {sales.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "En curso",          value: countActive,                              hi: countActive > 0 },
            { label: "Entregadas",        value: countDelivered,                           hi: false },
            { label: "Total facturado",   value: fmt(totalRevenue),                        hi: false },
            { label: "Pendiente cobro",   value: fmt(Math.max(0, totalPending)),           hi: totalPending > 0 },
          ].map(({ label, value, hi }) => (
            <div key={label} className="card px-4 py-4">
              <p style={{ fontSize: "11px", color: "var(--t3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
              <p style={{ fontSize: "22px", fontWeight: 700, color: hi ? "var(--accent)" : "var(--t1)", letterSpacing: "-0.02em", marginTop: "4px" }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {sales.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <ShoppingBag size={32} strokeWidth={1.2} style={{ color: "var(--border)", marginBottom: "12px" }} />
          <p style={{ fontWeight: 500, color: "var(--t2)", marginBottom: "4px" }}>Sin ventas</p>
          <p style={{ fontSize: "13px", color: "var(--t3)" }}>Creá la primera venta usando el botón de arriba</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {FILTER_OPTIONS.map((f) => {
              const count = f.value === "all" ? sales.length
                : f.value === "active" ? countActive
                : sales.filter((s) => s.status === f.value).length;
              if (f.value !== "all" && f.value !== "active" && count === 0) return null;
              const active = filter === f.value;
              const meta = f.value !== "all" && f.value !== "active" ? statusMeta(f.value) : null;
              return (
                <button key={f.value} onClick={() => setFilter(f.value)}
                  style={{
                    fontSize: "12px", fontWeight: 500, padding: "4px 12px", borderRadius: "20px", border: "none", cursor: "pointer",
                    color: active ? (meta?.color ?? "var(--accent)") : "var(--t3)",
                    background: active ? (meta?.bg ?? "var(--accent-bg)") : "var(--page-bg)",
                    outline: active ? `1.5px solid ${meta?.color ?? "var(--accent)"}` : "none",
                  }}>
                  {f.label} <span style={{ opacity: 0.6, marginLeft: "3px" }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Fecha", "Cliente", "Productos", "Total", "Pagado", "Estado", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => {
                  const items = parseItems(sale.items);
                  const pending = sale.totalAmount - sale.paidAmount;
                  const summary = items.length === 0 ? "—"
                    : items.length === 1 ? `${items[0].quantity > 1 ? `${items[0].quantity}× ` : ""}${items[0].name}`
                    : `${items[0].name} +${items.length - 1} más`;
                  return (
                    <tr key={sale.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "12px 14px", fontSize: "12px", color: "var(--t3)", whiteSpace: "nowrap" }}>
                        {new Date(sale.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Link href="/clients" style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                          {sale.client.name}
                        </Link>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: "13px", color: "var(--t2)", maxWidth: "200px" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{summary}</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 700, color: "var(--t1)", whiteSpace: "nowrap" }}>
                        {fmt(sale.totalAmount)}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: "12px", whiteSpace: "nowrap" }}>
                        {pending > 0 ? (
                          <button
                            onClick={() => markPaid(sale)}
                            className="flex items-center gap-1.5"
                            title="Marcar como pagado"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#d97706", fontWeight: 500, fontSize: "12px", padding: 0 }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = "0.7"}
                            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = "1"}
                          >
                            <CheckCircle size={13} /> Debe {fmt(pending)}
                          </button>
                        ) : (
                          <span className="flex items-center gap-1" style={{ color: "#16a34a", fontWeight: 500 }}>
                            <Check size={12} /> Pagado
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <StatusBadge sale={sale} onUpdate={updateSale} />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <button onClick={() => deleteSale(sale.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                          <Trash2 size={13} style={{ color: "var(--t3)" }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="flex items-center justify-center py-10" style={{ color: "var(--t3)", fontSize: "13px" }}>
                Sin ventas con este filtro
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
