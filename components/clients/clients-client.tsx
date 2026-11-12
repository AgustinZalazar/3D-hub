"use client";

import { useState, useCallback } from "react";
import {
  Users, Plus, Phone, Mail, MapPin, FileText, ChevronRight,
  X, Trash2, Package, ArrowLeft, Pencil, Check, AlertCircle,
} from "lucide-react";

type SaleItem = { name: string; quantity: number; unitPrice: number; colorVariant?: string; catalogItemId?: number };

type CatalogOption = {
  id: number;
  name: string;
  price: number | null;
  colorVariants: string | null;
  entries: { quote: { salePrice: number | null; salePriceWithFee: number | null } }[];
};

type Sale = {
  id: number;
  clientId: number;
  status: string;
  items: string;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Client = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  sales: Sale[];
};

const STATUSES: { value: string; label: string; color: string; bg: string }[] = [
  { value: "presupuestado", label: "Presupuestado", color: "var(--t3)", bg: "var(--page-bg)" },
  { value: "confirmado",    label: "Confirmado",    color: "#2563eb", bg: "#dbeafe" },
  { value: "en_produccion", label: "En producción", color: "#7c3aed", bg: "#ede9fe" },
  { value: "listo",         label: "Listo",         color: "#d97706", bg: "#fef3c7" },
  { value: "entregado",     label: "Entregado",     color: "#16a34a", bg: "#dcfce7" },
  { value: "cancelado",     label: "Cancelado",     color: "#dc2626", bg: "#fee2e2" },
];

function statusMeta(value: string) {
  return STATUSES.find((s) => s.value === value) ?? STATUSES[1];
}

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function parseItems(raw: string): SaleItem[] {
  try { return JSON.parse(raw); } catch { return []; }
}

// ─── New Client Modal ────────────────────────────────────────────────────────

function NewClientModal({ onCreated }: { onCreated: (c: Client) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const c = await res.json();
      onCreated({ ...c, sales: [] });
      setOpen(false);
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button className="btn-primary flex items-center gap-2" style={{ fontSize: "13px" }} onClick={() => setOpen(true)}>
        <Plus size={14} /> Nuevo cliente
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="card p-6 w-full max-w-md" style={{ background: "var(--card-bg)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontWeight: 600, fontSize: "16px", color: "var(--t1)" }}>Nuevo cliente</h2>
          <button onClick={() => setOpen(false)}><X size={16} style={{ color: "var(--t3)" }} /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Nombre *</label>
            <input
              className="input w-full mt-1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="Juan García"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Teléfono</label>
              <input className="input w-full mt-1" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="11 1234-5678" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Email</label>
              <input className="input w-full mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="juan@ejemplo.com" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Dirección</label>
            <input className="input w-full mt-1" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Calle 123, CABA" />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Notas</label>
            <textarea className="input w-full mt-1" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Info extra..." style={{ resize: "none" }} />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Guardando..." : "Crear cliente"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── New Sale Modal ──────────────────────────────────────────────────────────

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

function CatalogAutocomplete({ catalog, onAdd }: { catalog: CatalogOption[]; onAdd: (row: CatalogRow) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useState(() => ({ current: null as HTMLDivElement | null }))[0];
  const rows = buildCatalogRows(catalog);
  const filtered = query.trim()
    ? rows.filter((r) => `${r.name} ${r.colorVariant ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    : rows;

  function pick(row: CatalogRow) {
    onAdd(row);
    setQuery("");
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }} ref={(el) => { ref.current = el; }}>
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
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
            background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: "220px", overflowY: "auto",
          }}
        >
          {filtered.map((row, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => pick(row)}
              className="flex items-center justify-between w-full px-3 py-2 text-left"
              style={{ background: "none", border: "none", cursor: "pointer", borderBottom: i < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--page-bg)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "none"}
            >
              <div>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--t1)" }}>{row.name}</span>
                {row.colorVariant && (
                  <span style={{ fontSize: "12px", color: "var(--t3)", marginLeft: "6px" }}>{row.colorVariant}</span>
                )}
              </div>
              {row.price > 0 && (
                <span style={{ fontSize: "12px", color: "var(--t3)", flexShrink: 0, marginLeft: "12px" }}>{fmt(row.price)}</span>
              )}
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

function NewSaleModal({ clientId, catalog, onCreated }: { clientId: number; catalog: CatalogOption[]; onCreated: (s: Sale) => void }) {
  const [open, setOpen] = useState(false);
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

  function resetModal() { setItems([]); setStatus("confirmado"); setPaidAmount(0); setNotes(""); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
              <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500, display: "block", marginBottom: "6px" }}>
                Agregar del catálogo
              </label>
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
                      {it.colorVariant && (
                        <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "2px", paddingLeft: "2px" }}>{it.colorVariant}</p>
                      )}
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
            <button type="submit" className="btn-primary" disabled={loading || items.filter(i => i.name.trim()).length === 0}>
              {loading ? "Guardando..." : "Crear venta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sale Status Selector ─────────────────────────────────────────────────────

function SaleStatusBadge({ sale, onUpdate }: { sale: Sale; onUpdate: (updated: Sale) => void }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(sale.status);

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
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: "11px", fontWeight: 600, padding: "2px 10px", borderRadius: "20px", border: "none",
          color: meta.color, background: meta.bg, cursor: "pointer", letterSpacing: "0.01em",
        }}
      >
        {meta.label}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-10 rounded-lg shadow-lg py-1"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)", minWidth: "160px" }}
        >
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => changeStatus(s.value)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-left"
              style={{ fontSize: "12px", color: s.value === sale.status ? s.color : "var(--t2)", background: "none", border: "none" }}
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

// ─── Client Detail Panel ──────────────────────────────────────────────────────

function ClientDetail({
  client,
  catalog,
  onBack,
  onClientUpdate,
  onSaleAdd,
  onSaleUpdate,
  onSaleDelete,
}: {
  client: Client;
  catalog: CatalogOption[];
  onBack: () => void;
  onClientUpdate: (c: Client) => void;
  onSaleAdd: (s: Sale) => void;
  onSaleUpdate: (s: Sale) => void;
  onSaleDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: client.name, phone: client.phone ?? "", email: client.email ?? "", address: client.address ?? "", notes: client.notes ?? "" });
  const [saving, setSaving] = useState(false);

  const totalRevenue = client.sales.reduce((s, sale) => s + sale.totalAmount, 0);
  const totalPaid = client.sales.reduce((s, sale) => s + sale.paidAmount, 0);
  const activeSales = client.sales.filter((s) => s.status !== "cancelado" && s.status !== "entregado");

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      onClientUpdate({ ...client, ...form });
      setEditing(false);
    }
    setSaving(false);
  }

  async function deleteSale(id: number) {
    if (!confirm("¿Eliminar esta venta?")) return;
    const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
    if (res.ok) onSaleDelete(id);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1" style={{ color: "var(--t3)", fontSize: "13px", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={14} /> Clientes
        </button>
      </div>

      {/* Client info card */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-4">
          {editing ? (
            <form onSubmit={saveEdit} className="flex flex-col gap-3 w-full">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Nombre *</label>
                  <input className="input w-full mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Teléfono</label>
                  <input className="input w-full mt-1" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Email</label>
                  <input className="input w-full mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Dirección</label>
                  <input className="input w-full mt-1" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}>Notas</label>
                <textarea className="input w-full mt-1" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ resize: "none" }} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" style={{ fontSize: "13px" }} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                <button type="button" className="btn-secondary" style={{ fontSize: "13px" }} onClick={() => setEditing(false)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: "20px", color: "var(--t1)", letterSpacing: "-0.02em" }}>{client.name}</h2>
                <div className="flex flex-col gap-1 mt-2">
                  {client.phone && (
                    <span style={{ fontSize: "13px", color: "var(--t2)" }} className="flex items-center gap-1.5">
                      <Phone size={12} style={{ color: "var(--t3)" }} /> {client.phone}
                    </span>
                  )}
                  {client.email && (
                    <span style={{ fontSize: "13px", color: "var(--t2)" }} className="flex items-center gap-1.5">
                      <Mail size={12} style={{ color: "var(--t3)" }} /> {client.email}
                    </span>
                  )}
                  {client.address && (
                    <span style={{ fontSize: "13px", color: "var(--t2)" }} className="flex items-center gap-1.5">
                      <MapPin size={12} style={{ color: "var(--t3)" }} /> {client.address}
                    </span>
                  )}
                  {client.notes && (
                    <span style={{ fontSize: "13px", color: "var(--t3)" }} className="flex items-center gap-1.5">
                      <FileText size={12} style={{ color: "var(--t3)" }} /> {client.notes}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setEditing(true)} style={{ color: "var(--t3)", background: "none", border: "none", cursor: "pointer" }}>
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>

        {!editing && (
          <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div>
              <p style={{ fontSize: "11px", color: "var(--t3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ventas</p>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>{client.sales.length}</p>
            </div>
            <div>
              <p style={{ fontSize: "11px", color: "var(--t3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total facturado</p>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>{fmt(totalRevenue)}</p>
            </div>
            <div>
              <p style={{ fontSize: "11px", color: "var(--t3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pendiente cobro</p>
              <p style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", color: totalRevenue - totalPaid > 0 ? "#d97706" : "var(--t1)" }}>
                {fmt(totalRevenue - totalPaid)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sales */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontWeight: 600, fontSize: "15px", color: "var(--t1)" }}>
            Ventas {activeSales.length > 0 && <span style={{ color: "var(--t3)", fontWeight: 400 }}>({activeSales.length} activa{activeSales.length !== 1 ? "s" : ""})</span>}
          </h3>
          <NewSaleModal clientId={client.id} catalog={catalog} onCreated={onSaleAdd} />
        </div>

        {client.sales.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-10 text-center">
            <Package size={28} strokeWidth={1.2} style={{ color: "var(--border)", marginBottom: "10px" }} />
            <p style={{ fontWeight: 500, color: "var(--t2)", fontSize: "14px" }}>Sin ventas</p>
            <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>Creá la primera venta para este cliente</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {client.sales.map((sale) => {
              const items = parseItems(sale.items);
              const pending = sale.totalAmount - sale.paidAmount;
              return (
                <div key={sale.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <SaleStatusBadge sale={sale} onUpdate={onSaleUpdate} />
                      <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "4px" }}>
                        {new Date(sale.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                        {sale.deliveredAt && ` · Entregado ${new Date(sale.deliveredAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>{fmt(sale.totalAmount)}</p>
                        {pending > 0 && (
                          <p style={{ fontSize: "11px", color: "#d97706", fontWeight: 500 }}>Debe {fmt(pending)}</p>
                        )}
                        {pending <= 0 && sale.totalAmount > 0 && (
                          <p style={{ fontSize: "11px", color: "#16a34a", fontWeight: 500 }}>Pagado</p>
                        )}
                      </div>
                      <button onClick={() => deleteSale(sale.id)} style={{ color: "var(--t3)", background: "none", border: "none", cursor: "pointer" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "10px" }}>
                      {items.map((it, i) => (
                        <div key={i} className="flex justify-between" style={{ fontSize: "13px", color: "var(--t2)", padding: "2px 0" }}>
                          <span>{it.quantity > 1 ? `${it.quantity}× ` : ""}{it.name}{it.colorVariant ? ` (${it.colorVariant})` : ""}</span>
                          <span style={{ color: "var(--t3)" }}>{fmt(it.quantity * it.unitPrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {sale.notes && (
                    <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "8px", fontStyle: "italic" }}>{sale.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClientsClient({ initialClients, catalogItems = [] }: { initialClients: Client[]; catalogItems?: CatalogOption[] }) {
  const [clients, setClients] = useState(initialClients);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const selected = selectedId != null ? clients.find((c) => c.id === selectedId) ?? null : null;

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const addClient = useCallback((c: Client) => {
    setClients((prev) => [c, ...prev]);
    setSelectedId(c.id);
  }, []);

  const updateClient = useCallback((updated: Client) => {
    setClients((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
  }, []);

  const addSale = useCallback((sale: Sale) => {
    setClients((prev) => prev.map((c) => c.id === sale.clientId ? { ...c, sales: [sale, ...c.sales] } : c));
  }, []);

  const updateSale = useCallback((updated: Sale) => {
    setClients((prev) => prev.map((c) => c.id === updated.clientId
      ? { ...c, sales: c.sales.map((s) => s.id === updated.id ? updated : s) }
      : c
    ));
  }, []);

  const deleteSale = useCallback((id: number) => {
    setClients((prev) => prev.map((c) => ({ ...c, sales: c.sales.filter((s) => s.id !== id) })));
  }, []);

  // Stats
  const totalRevenue = clients.flatMap((c) => c.sales).reduce((s, sale) => s + sale.totalAmount, 0);
  const pendingCollection = clients.flatMap((c) => c.sales).reduce((s, sale) => s + (sale.totalAmount - sale.paidAmount), 0);
  const activeSalesCount = clients.flatMap((c) => c.sales).filter((s) => s.status !== "cancelado" && s.status !== "entregado").length;

  if (selected) {
    return (
      <ClientDetail
        client={selected}
        catalog={catalogItems}
        onBack={() => setSelectedId(null)}
        onClientUpdate={updateClient}
        onSaleAdd={addSale}
        onSaleUpdate={updateSale}
        onSaleDelete={deleteSale}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold tracking-tight" style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}>
            Clientes
          </h1>
          <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
            {clients.length} cliente{clients.length !== 1 ? "s" : ""}
            {activeSalesCount > 0 && ` · ${activeSalesCount} venta${activeSalesCount !== 1 ? "s" : ""} activa${activeSalesCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <NewClientModal onCreated={addClient} />
      </div>

      {/* Stats */}
      {clients.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Clientes", value: clients.length.toString() },
            { label: "Total facturado", value: fmt(totalRevenue) },
            { label: "Pendiente cobro", value: fmt(pendingCollection), warn: pendingCollection > 0 },
          ].map(({ label, value, warn }) => (
            <div key={label} className="card p-4">
              <p style={{ fontSize: "11px", color: "var(--t3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
              <p style={{ fontSize: "22px", fontWeight: 700, color: warn ? "#d97706" : "var(--t1)", letterSpacing: "-0.02em", marginTop: "4px" }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Users size={32} strokeWidth={1.2} style={{ color: "var(--border)", marginBottom: "12px" }} />
          <p style={{ fontWeight: 500, color: "var(--t2)", marginBottom: "4px" }}>Sin clientes</p>
          <p style={{ fontSize: "13px", color: "var(--t3)" }}>Agregá tu primer cliente para empezar a registrar ventas</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <input
            className="input w-full mb-4"
            placeholder="Buscar cliente por nombre, teléfono o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: "360px" }}
          />

          {/* Table */}
          <div className="card overflow-hidden">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Cliente", "Teléfono", "Ventas", "Total facturado", "Pendiente", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const revenue = c.sales.reduce((s, sale) => s + sale.totalAmount, 0);
                  const pending = c.sales.reduce((s, sale) => s + (sale.totalAmount - sale.paidAmount), 0);
                  const lastSale = c.sales[0];
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--page-bg)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)" }}>{c.name}</p>
                        {lastSale && (
                          <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "1px" }}>
                            Última venta: {new Date(lastSale.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "var(--t2)" }}>{c.phone ?? "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "var(--t2)" }}>{c.sales.length}</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, color: "var(--t1)" }}>{fmt(revenue)}</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, color: pending > 0 ? "#d97706" : "var(--t3)" }}>
                        {pending > 0 ? fmt(pending) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <ChevronRight size={15} style={{ color: "var(--t3)" }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="flex items-center justify-center py-8" style={{ color: "var(--t3)", fontSize: "13px" }}>
                <AlertCircle size={14} style={{ marginRight: "6px" }} /> Sin resultados para "{search}"
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
