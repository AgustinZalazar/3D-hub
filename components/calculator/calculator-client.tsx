"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, X, ChevronDown, ChevronUp, Save, Settings2, Copy, Check, Package, Search } from "lucide-react";
import Link from "next/link";
import type { Filament, PrinterProfile } from "@prisma/client";
import {
  useCalculator,
  defaultState,
  buildSummary,
  type CalculatorState,
  type FilamentRow,
  type MaterialRow,
} from "@/lib/calculator/use-calculator";

interface PlateInfo {
  index: number;
  estimatedSeconds: number;
  totalGrams: number;
  thumbnailEntry: string | null;
  filaments: { slotId: string; colorHex: string; material: string; grams: number; meters: number }[];
}

interface Model {
  fileName: string;
  thumbnailEntry: string | null;
  totalGrams: number;
  estimatedSeconds: number | null;
  filaments: { colorHex: string; material: string; grams: number }[];
  plates?: PlateInfo[];
  dataSource?: "gcode" | "geometry" | "none" | "slice_info";
}

interface InitialData {
  quoteId: number;
  quoteName: string;
  state: CalculatorState;
  selectedModels: string[];
}

interface Props {
  filaments: Filament[];
  printerProfiles: PrinterProfile[];
  models: Model[];
  initialData?: InitialData | null;
}

function fmt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export function CalculatorClient({ filaments, printerProfiles, models, initialData }: Props) {
  const router = useRouter();
  const [state, setState] = useState<CalculatorState>(() => initialData?.state ?? defaultState());
  const [showExtras, setShowExtras] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(() => initialData?.selectedModels ?? []);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState(initialData?.quoteName ?? "");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [geometryCache, setGeometryCache] = useState<Record<string, { totalGrams: number; estimatedSeconds: number | null; filaments: Model["filaments"]; plates?: PlateInfo[]; dataSource: Model["dataSource"] }>>({});
  const [loadingSlice, setLoadingSlice] = useState<string | null>(null);

  // Profiles managed locally so saving a profile doesn't reset the calculator form
  const [profiles, setProfiles] = useState<PrinterProfile[]>(printerProfiles);
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [saveProfileName, setSaveProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const result = useCalculator(state);

  const set = useCallback(<K extends keyof CalculatorState>(key: K, value: CalculatorState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  function loadPrinterProfile(profileId: string) {
    const p = profiles.find((p) => p.id === parseInt(profileId));
    if (!p) return;
    setState((prev) => ({
      ...prev,
      wattage: String(p.wattage),
      kwHPrice: String(p.kwHPrice),
      lifeHours: String(p.lifeHours),
      partsPrice: String(p.partsPrice),
      errorMarginPct: String(p.errorMarginPct),
    }));
  }

  async function saveAsProfile() {
    if (!saveProfileName.trim()) return;
    setSavingProfile(true);
    const res = await fetch("/api/printer-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: saveProfileName.trim(),
        wattage: state.wattage,
        kwHPrice: state.kwHPrice,
        lifeHours: state.lifeHours,
        partsPrice: state.partsPrice,
        errorMarginPct: state.errorMarginPct,
        isDefault: profiles.length === 0,
      }),
    });
    const created = await res.json();
    setProfiles((prev) => [...prev, created]);
    setSaveProfileName("");
    setShowSaveProfile(false);
    setSavingProfile(false);
  }

  function recalcFromSelected(nextSelected: string[], cache: typeof geometryCache) {
    // Merge prop data with fetched geometry cache
    const resolved = models.map((m) => cache[m.fileName] ? { ...m, ...cache[m.fileName] } : m);
    const allModels = resolved.filter((m) => nextSelected.includes(m.fileName));
    const totalSeconds = allModels.reduce((s, m) => s + (m.estimatedSeconds ?? 0), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);

    const mergedFilaments = new Map<string, { grams: number; material: string }>();
    for (const m of allModels) {
      for (const f of m.filaments) {
        const existing = mergedFilaments.get(f.colorHex);
        mergedFilaments.set(f.colorHex, {
          grams: (existing?.grams ?? 0) + f.grams,
          material: f.material,
        });
      }
    }

    const newFilamentRows: FilamentRow[] = Array.from(mergedFilaments.entries()).map(
      ([colorHex, { grams, material }]) => {
        const match = filaments.find(
          (f) =>
            f.colorHex?.toLowerCase() === colorHex.toLowerCase() ||
            f.material.toLowerCase() === material.toLowerCase()
        );
        return {
          id: uid(),
          filamentId: match?.id ?? null,
          label: match ? `${match.brand} ${match.color} ${match.material}` : colorHex,
          pricePerKg: match?.pricePerKg != null ? String(match.pricePerKg) : "",
          grams: grams > 0 ? String(Math.round(grams * 10) / 10) : "",
        };
      }
    );

    setState((prev) => ({
      ...prev,
      filaments: newFilamentRows.length > 0
        ? newFilamentRows
        : [{ id: uid(), filamentId: null, label: "", pricePerKg: "", grams: "" }],
      printHours: totalSeconds > 0 ? String(hours) : prev.printHours,
      printMinutes: totalSeconds > 0 ? String(minutes) : prev.printMinutes,
    }));
  }

  async function sliceModel(fileName: string) {
    setLoadingSlice(fileName);
    try {
      const res = await fetch("/api/models/slice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      if (res.ok) {
        const data = await res.json();
        const cache = { ...geometryCache, [fileName]: { ...data, dataSource: "slice_info" as const } };
        setGeometryCache(cache);
        if (selectedModels.includes(fileName)) recalcFromSelected(selectedModels, cache);
      }
    } catch { /* ignore */ }
    setLoadingSlice(null);
  }

  function toggleModel(fileName: string) {
    const nextSelected = selectedModels.includes(fileName)
      ? selectedModels.filter((f) => f !== fileName)
      : [...selectedModels, fileName];
    setSelectedModels(nextSelected);
    recalcFromSelected(nextSelected, geometryCache);
  }

  function updateFilament(id: string, field: keyof FilamentRow, value: string | number | null) {
    setState((prev) => ({
      ...prev,
      filaments: prev.filaments.map((f) =>
        f.id === id ? { ...f, [field]: value } : f
      ),
    }));
  }

  function selectFilamentFromDB(rowId: string, filamentId: string) {
    const f = filaments.find((f) => f.id === parseInt(filamentId));
    if (!f) return;
    setState((prev) => ({
      ...prev,
      filaments: prev.filaments.map((r) =>
        r.id === rowId
          ? {
              ...r,
              filamentId: f.id,
              label: `${f.brand} ${f.color} ${f.material}`,
              pricePerKg: f.pricePerKg != null ? String(f.pricePerKg) : r.pricePerKg,
            }
          : r
      ),
    }));
  }

  function addFilamentRow() {
    setState((prev) => ({
      ...prev,
      filaments: [...prev.filaments, { id: uid(), filamentId: null, label: "", pricePerKg: "", grams: "" }],
    }));
  }

  function removeFilamentRow(id: string) {
    setState((prev) => ({
      ...prev,
      filaments: prev.filaments.length > 1 ? prev.filaments.filter((f) => f.id !== id) : prev.filaments,
    }));
  }

  function addMaterial() {
    setState((prev) => ({
      ...prev,
      externalMaterials: [...prev.externalMaterials, { id: uid(), name: "", price: "" }],
    }));
  }

  function updateMaterial(id: string, field: keyof MaterialRow, value: string) {
    setState((prev) => ({
      ...prev,
      externalMaterials: prev.externalMaterials.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    }));
  }

  function removeMaterial(id: string) {
    setState((prev) => ({
      ...prev,
      externalMaterials: prev.externalMaterials.filter((m) => m.id !== id),
    }));
  }

  async function saveQuote() {
    if (!saveName.trim()) return;
    setSaving(true);
    await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: saveName.trim(),
        modelFiles: selectedModels,
        filamentsData: state.filaments.map((f) => ({
          filamentId: f.filamentId,
          label: f.label,
          pricePerKg: parseFloat(f.pricePerKg) || 0,
          grams: parseFloat(f.grams) || 0,
        })),
        printHours: state.printHours,
        printMinutes: state.printMinutes,
        wattage: state.wattage,
        kwHPrice: state.kwHPrice,
        lifeHours: state.lifeHours,
        partsPrice: state.partsPrice,
        errorMarginPct: state.errorMarginPct,
        externalMaterials: state.externalMaterials.map((m) => ({
          name: m.name,
          price: parseFloat(m.price) || 0,
        })),
        fixedCosts: state.fixedCosts,
        profitMode: state.profitMode,
        profitValue: state.profitValue,
        commissionPct: state.commissionPct,
        productionCost: result.productionCost,
        totalCost: result.totalCost,
        salePrice: result.salePrice,
        salePriceWithFee: result.salePriceWithFee,
      }),
    });
    setSaving(false);
    setShowSaveModal(false);
    setSaveName("");
    router.refresh();
  }

  async function copyResult() {
    const text = buildSummary(saveName || initialData?.quoteName || "", state, result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select a temporary textarea
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.fileName.replace(/\.3mf$/i, "").toLowerCase().includes(q));
  }, [models, modelSearch]);

  return (
    <>
    {/* ── Model picker modal ── */}
    {showModelModal && (
      <div
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        onClick={() => setShowModelModal(false)}
      >
        <div
          className="card"
          style={{ width: "100%", maxWidth: "760px", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }} />
              <input
                autoFocus
                type="text"
                placeholder="Buscar modelo..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="field-input"
                style={{ paddingLeft: "30px", fontSize: "13px", width: "100%" }}
              />
            </div>
            <span style={{ fontSize: "12px", color: "var(--t3)", whiteSpace: "nowrap" }}>
              {selectedModels.length > 0 ? `${selectedModels.length} seleccionado${selectedModels.length > 1 ? "s" : ""}` : "Ninguno"}
            </span>
            <button
              onClick={() => setShowModelModal(false)}
              style={{ padding: "6px", borderRadius: "6px", border: "none", background: "transparent", cursor: "pointer", color: "var(--t3)", display: "flex" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Grid */}
          <div style={{ overflowY: "auto", padding: "16px", flex: 1 }}>
            {filteredModels.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--t3)", textAlign: "center", padding: "32px 0" }}>Sin resultados</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
                {filteredModels.map((m) => {
                  const sel = selectedModels.includes(m.fileName);
                  const isLoading = loadingSlice === m.fileName;
                  const isSlicing = isLoading;
                  const resolved = geometryCache[m.fileName] ? { ...m, ...geometryCache[m.fileName] } : m;
                  const resolvedSource = resolved.dataSource;
                  const thumbUrl = m.thumbnailEntry
                    ? `/api/models/thumbnail?file=${encodeURIComponent(m.fileName)}&entry=${encodeURIComponent(m.thumbnailEntry)}`
                    : null;
                  return (
                    <button
                      key={m.fileName}
                      type="button"
                      onClick={() => toggleModel(m.fileName)}
                      disabled={isLoading}
                      style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        textAlign: "left",
                        border: `2px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: "10px",
                        background: sel ? "var(--accent-bg)" : "var(--card-bg)",
                        cursor: isLoading ? "wait" : "pointer",
                        overflow: "hidden",
                        padding: 0,
                        transition: "border-color 0.1s",
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--page-bg)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {thumbUrl ? (
                          <Image src={thumbUrl} alt="" fill className="object-contain p-2" unoptimized />
                        ) : (
                          <Package size={28} strokeWidth={1.2} style={{ color: "var(--border)" }} />
                        )}
                        {sel && (
                          <span style={{ position: "absolute", top: "6px", right: "6px", width: "18px", height: "18px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={11} strokeWidth={3} style={{ color: "white" }} />
                          </span>
                        )}
                        {isLoading && (
                          <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "white" }}>
                            {isSlicing ? "sliceando..." : "calculando..."}
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div style={{ padding: "8px 10px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--t1)", lineHeight: "1.3", marginBottom: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {m.fileName.replace(/\.3mf$/i, "").replace(/[_-]/g, " ")}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                          {resolved.filaments.slice(0, 4).map((f, fi) => (
                            <span key={fi} style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: f.colorHex, border: "1px solid var(--border)", flexShrink: 0 }} />
                          ))}
                          {resolved.totalGrams > 0 && (
                            <span style={{ fontSize: "10px", color: "var(--t3)", marginLeft: "2px" }}>
                              {resolved.totalGrams.toFixed(0)}g{resolvedSource === "geometry" ? " est." : ""}
                            </span>
                          )}
                          {resolvedSource === "slice_info" && resolved.plates && resolved.plates.length > 1 && (
                            <span style={{ fontSize: "10px", color: "var(--accent)", marginLeft: "2px" }}>{resolved.plates.length}p</span>
                          )}
                          {resolved.totalGrams === 0 && !isLoading && resolvedSource !== "slice_info" && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); sliceModel(m.fileName); }}
                              style={{ fontSize: "9px", color: "var(--accent)", fontWeight: 600, background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: "4px", padding: "1px 5px", cursor: "pointer" }}
                            >
                              Slicear
                            </button>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowModelModal(false)}
              className="px-4 py-2 rounded-lg font-medium text-sm"
              style={{ background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="flex gap-6 items-start">
      {/* ── LEFT PANEL ── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Models picker */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">Modelos 3D</p>
            {models.length > 0 && (
              <button
                type="button"
                onClick={() => setShowModelModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--accent-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-border)", cursor: "pointer" }}
              >
                <Package size={12} />
                {selectedModels.length > 0 ? `${selectedModels.length} seleccionado${selectedModels.length > 1 ? "s" : ""}` : "Seleccionar"}
              </button>
            )}
          </div>
          {models.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--t3)" }}>No hay modelos — configurá GCODE_FOLDER en .env</p>
          ) : selectedModels.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowModelModal(true)}
              className="w-full flex items-center justify-center gap-2 py-6 rounded-lg transition-colors"
              style={{ border: "1.5px dashed var(--border)", background: "transparent", cursor: "pointer", color: "var(--t3)", fontSize: "13px" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              <Package size={16} strokeWidth={1.5} />
              Elegir modelo para cotizar
            </button>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {selectedModels.map((fileName) => {
                const m = models.find((x) => x.fileName === fileName);
                const resolved = m && geometryCache[fileName] ? { ...m, ...geometryCache[fileName] } : m;
                const thumbUrl = m?.thumbnailEntry
                  ? `/api/models/thumbnail?file=${encodeURIComponent(fileName)}&entry=${encodeURIComponent(m.thumbnailEntry)}`
                  : null;
                return (
                  <div
                    key={fileName}
                    className="flex items-center gap-2 rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--accent-border)", background: "var(--accent-bg)", maxWidth: "220px" }}
                  >
                    {thumbUrl && (
                      <div style={{ width: "40px", height: "40px", flexShrink: 0, position: "relative", background: "var(--page-bg)" }}>
                        <Image src={thumbUrl} alt="" fill className="object-contain p-1" unoptimized />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0, padding: thumbUrl ? "6px 0" : "6px 10px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent-text)", lineHeight: 1.2 }} className="truncate">
                        {fileName.replace(/\.3mf$/i, "").replace(/[_-]/g, " ")}
                      </p>
                      {resolved && resolved.totalGrams > 0 && (
                        <p style={{ fontSize: "10px", color: "var(--t3)", marginTop: "2px" }}>
                          {resolved.totalGrams.toFixed(0)}g{resolved.dataSource === "geometry" ? " est." : ""}
                          {resolved.estimatedSeconds ? ` · ${formatTime(resolved.estimatedSeconds)}` : ""}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModel(fileName)}
                      style={{ padding: "8px 8px", color: "var(--t3)", background: "none", border: "none", cursor: "pointer", display: "flex", flexShrink: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setShowModelModal(true)}
                className="flex items-center gap-1 rounded-lg px-3"
                style={{ border: "1.5px dashed var(--border)", background: "transparent", cursor: "pointer", color: "var(--t3)", fontSize: "12px", height: "40px" }}
              >
                <Plus size={12} /> agregar
              </button>
            </div>
          )}
        </div>

        {/* Filaments */}
        <div className="card p-4">
          <p className="section-title">Filamento</p>
          <div className="space-y-3 mt-3">
            {state.filaments.map((row, i) => (
              <FilamentRowInput
                key={row.id}
                row={row}
                index={i}
                filaments={filaments}
                onSelect={(fid) => selectFilamentFromDB(row.id, fid)}
                onChange={(field, val) => updateFilament(row.id, field, val)}
                onRemove={() => removeFilamentRow(row.id)}
                canRemove={state.filaments.length > 1}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addFilamentRow}
            className="mt-3 flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 500 }}
          >
            <Plus size={14} /> Agregar filamento
          </button>
        </div>

        {/* Print time */}
        <div className="card p-4">
          <p className="section-title">Tiempo de impresión</p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <NumField label="Horas" unit="h" value={state.printHours} onChange={(v) => set("printHours", v)} />
            <NumField label="Minutos" unit="min" value={state.printMinutes} onChange={(v) => set("printMinutes", v)} />
          </div>
        </div>

        {/* Printer config */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">Impresora y consumo</p>
            <div className="flex items-center gap-2">
              {profiles.length > 0 && (
                <select
                  className="field-input"
                  style={{ width: "auto", fontSize: "12px", padding: "4px 8px" }}
                  defaultValue=""
                  onChange={(e) => loadPrinterProfile(e.target.value)}
                >
                  <option value="" disabled>Cargar perfil...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.isDefault ? " (default)" : ""}</option>
                  ))}
                </select>
              )}
              <Link
                href="/printer-profiles"
                title="Administrar perfiles"
                className="p-1.5 rounded-md transition-colors"
                style={{ color: "var(--t3)", display: "flex" }}
              >
                <Settings2 size={14} />
              </Link>
            </div>
          </div>

          {profiles.length > 0 && profiles.some((p) => p.isDefault) && !state.kwHPrice && (
            <div className="mb-3">
              {(() => {
                const def = profiles.find((p) => p.isDefault)!;
                return (
                  <button
                    type="button"
                    onClick={() => loadPrinterProfile(String(def.id))}
                    className="text-xs px-3 py-1.5 rounded-md transition-colors"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)", fontWeight: 500 }}
                  >
                    Cargar {def.name}
                  </button>
                );
              })()}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumField label="Consumo real" unit="W" value={state.wattage} onChange={(v) => set("wattage", v)} />
            <NumField label="Precio kWh" unit="$" value={state.kwHPrice} onChange={(v) => set("kwHPrice", v)} />
            <NumField label="Vida útil" unit="h" value={state.lifeHours} onChange={(v) => set("lifeHours", v)} />
            <NumField label="Precio repuestos" unit="$" value={state.partsPrice} onChange={(v) => set("partsPrice", v)} />
            <div className="col-span-2">
              <NumField label="Margen de error" unit="%" value={state.errorMarginPct} onChange={(v) => set("errorMarginPct", v)} />
            </div>
          </div>

          {/* Save as profile */}
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            {!showSaveProfile ? (
              <button
                type="button"
                onClick={() => setShowSaveProfile(true)}
                className="flex items-center gap-1.5"
                style={{ fontSize: "12px", color: "var(--t3)", fontWeight: 500 }}
              >
                <Save size={12} /> Guardar como perfil
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={saveProfileName}
                  onChange={(e) => setSaveProfileName(e.target.value)}
                  placeholder="Nombre del perfil"
                  className="field-input flex-1"
                  style={{ fontSize: "12px" }}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveAsProfile(); if (e.key === "Escape") setShowSaveProfile(false); }}
                />
                <button
                  type="button"
                  onClick={saveAsProfile}
                  disabled={savingProfile || !saveProfileName.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "var(--accent)", color: "white", whiteSpace: "nowrap" }}
                >
                  {savingProfile ? "..." : "Guardar"}
                </button>
                <button type="button" onClick={() => setShowSaveProfile(false)} style={{ color: "var(--t3)" }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Extras */}
        <Section
          title="Extras"
          hint="insumos, materiales externos"
          open={showExtras}
          onToggle={() => setShowExtras((v) => !v)}
        >
          {state.externalMaterials.map((m) => (
            <div key={m.id} className="flex gap-2 items-center mb-2">
              <input
                type="text"
                value={m.name}
                onChange={(e) => updateMaterial(m.id, "name", e.target.value)}
                placeholder="Material o insumo"
                className="field-input flex-1"
                style={{ fontSize: "13px" }}
              />
              <div className="relative" style={{ width: "110px" }}>
                <input
                  type="number"
                  value={m.price}
                  onChange={(e) => updateMaterial(m.id, "price", e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                  className="field-input"
                  style={{ paddingRight: "24px", fontSize: "13px" }}
                />
                <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "var(--t3)", pointerEvents: "none" }}>$</span>
              </div>
              <button type="button" onClick={() => removeMaterial(m.id)} style={{ color: "var(--t3)", flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addMaterial} className="flex items-center gap-1.5 mt-1" style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 500 }}>
            <Plus size={14} /> Agregar material
          </button>
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <NumField label="Insumos fijos (diseño, postprocesado)" unit="$" value={state.fixedCosts} onChange={(v) => set("fixedCosts", v)} />
          </div>
        </Section>

        {/* Profit */}
        <div className="card p-4">
          <p className="section-title" style={{ marginBottom: "12px" }}>Ganancia</p>
          <div className="flex gap-2 mb-3">
            <ModeBtn active={state.profitMode === "multiplier"} onClick={() => set("profitMode", "multiplier")}>Multiplicador</ModeBtn>
            <ModeBtn active={state.profitMode === "percentage"} onClick={() => set("profitMode", "percentage")}>Porcentaje</ModeBtn>
          </div>
          {state.profitMode === "multiplier" ? (
            <>
              <div className="flex gap-2 flex-wrap mb-3">
                {[["Mayorista", "3"], ["Minorista", "4"], ["Llaveros", "5"]].map(([label, val]) => (
                  <PresetBtn key={val} active={state.profitValue === val} onClick={() => set("profitValue", val)}>
                    {label} ×{val}
                  </PresetBtn>
                ))}
              </div>
              <NumField label="Multiplicador personalizado" unit="×" value={state.profitValue} onChange={(v) => set("profitValue", v)} />
            </>
          ) : (
            <NumField label="Porcentaje de ganancia" unit="%" value={state.profitValue} onChange={(v) => set("profitValue", v)} />
          )}
        </div>

        {/* Commission */}
        <div className="card p-4">
          <p className="section-title" style={{ marginBottom: "12px" }}>Comisión de venta</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {[["Mercado Libre", "18"], ["Sin comisión", "0"]].map(([label, val]) => (
              <PresetBtn key={val} active={state.commissionPct === val} onClick={() => set("commissionPct", val)}>
                {label}{val !== "0" && ` (${val}%)`}
              </PresetBtn>
            ))}
          </div>
          <NumField label="Comisión personalizada" unit="%" value={state.commissionPct} onChange={(v) => set("commissionPct", v)} />
        </div>

      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ width: "300px", flexShrink: 0 }} className="sticky top-8">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)" }}>Resultado</p>
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "var(--accent)", color: "white", fontSize: "12px", fontWeight: 600 }}
            >
              <Save size={12} /> Guardar
            </button>
          </div>

          {/* Total */}
          <div className="rounded-lg p-4 mb-4" style={{ background: "var(--page-bg)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: "11px", color: "var(--t3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Total a cobrar</p>
            <p style={{ fontSize: "26px", fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
              $ {fmt(result.salePrice)}
            </p>
            {parseFloat(state.commissionPct) > 0 && (
              <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
                Con comisión (+{state.commissionPct}%): <strong style={{ color: "var(--t2)" }}>$ {fmt(result.salePriceWithFee)}</strong>
              </p>
            )}
            <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
              Ganancia: $ {fmt(result.profit)}
              {state.profitMode === "multiplier" && parseFloat(state.profitValue) > 0 && (
                <span> (×{state.profitValue} sobre costo)</span>
              )}
            </p>
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={copyResult}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg mb-4 transition-colors"
            style={{
              background: copied ? "var(--success-bg, var(--accent-bg))" : "var(--page-bg)",
              color: copied ? "var(--success, var(--accent))" : "var(--t3)",
              border: "1px solid var(--border)",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "¡Copiado!" : "Copiar resumen"}
          </button>

          {/* Breakdown */}
          <div className="space-y-1">
            <ResultGroup label="Costos base">
              {state.filaments.map((f, i) => (
                <ResultRow
                  key={f.id}
                  label={f.label || `Filamento ${i + 1}`}
                  value={result.filamentCost > 0 ? (parseFloat(f.pricePerKg) / 1000) * (parseFloat(f.grams) || 0) : 0}
                />
              ))}
              <ResultRow label="Electricidad" value={result.electricityCost} />
              <ResultRow label="Desgaste impresora" value={result.wearCost} />
              {state.externalMaterials.map((m) => (
                <ResultRow key={m.id} label={m.name || "Material"} value={parseFloat(m.price) || 0} />
              ))}
            </ResultGroup>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "8px" }}>
              <ResultRow label="Margen de error" value={result.productionCost - (result.filamentCost + result.electricityCost + result.wearCost + result.materialsCost)} />
              <ResultRow label="Costo de producción" value={result.productionCost} bold />
              {parseFloat(state.fixedCosts) > 0 && (
                <ResultRow label="Insumos fijos" value={parseFloat(state.fixedCosts) || 0} />
              )}
              <ResultRow label="Total de costos" value={result.totalCost} bold />
            </div>
          </div>
        </div>
      </div>

      {/* Save modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }}
        >
          <div className="absolute inset-0" style={{ background: "oklch(0.145 0.015 265 / 0.30)", backdropFilter: "blur(2px)" }} />
          <div className="relative card p-5" style={{ width: "360px" }}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t1)" }}>Guardar cotización</p>
              <button type="button" onClick={() => setShowSaveModal(false)} style={{ color: "var(--t3)" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "6px" }}>
                Nombre del producto
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Ej: Llavero gato, Maceta modular..."
                className="field-input"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveQuote(); }}
              />
            </div>
            <div className="rounded-lg p-3 mb-4" style={{ background: "var(--page-bg)", fontSize: "12px", color: "var(--t3)" }}>
              <div className="flex justify-between">
                <span>Costo de producción</span>
                <span style={{ color: "var(--t2)" }}>$ {fmt(result.productionCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Precio de venta</span>
                <strong style={{ color: "var(--t1)" }}>$ {fmt(result.salePrice)}</strong>
              </div>
            </div>
            <button
              type="button"
              onClick={saveQuote}
              disabled={saving || !saveName.trim()}
              className="btn-primary w-full"
            >
              {saving ? "Guardando..." : "Guardar producto"}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function FilamentRowInput({
  row,
  index,
  filaments,
  onSelect,
  onChange,
  onRemove,
  canRemove,
}: {
  row: FilamentRow;
  index: number;
  filaments: Filament[];
  onSelect: (id: string) => void;
  onChange: (field: keyof FilamentRow, val: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--page-bg)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)" }}>Filamento {index + 1}</p>
        {canRemove && (
          <button type="button" onClick={onRemove} style={{ color: "var(--t3)" }}>
            <X size={13} />
          </button>
        )}
      </div>
      <div className="space-y-2">
        <select
          className="field-input"
          style={{ fontSize: "12px" }}
          value={row.filamentId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">Seleccionar de mis filamentos...</option>
          {filaments.map((f) => (
            <option key={f.id} value={f.id}>
              {f.brand} {f.color} {f.material}{f.pricePerKg ? ` — $${f.pricePerKg.toLocaleString()}/kg` : ""}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <input
              type="number"
              value={row.pricePerKg}
              onChange={(e) => onChange("pricePerKg", e.target.value)}
              placeholder="Precio/kg"
              min="0"
              step="any"
              className="field-input"
              style={{ paddingRight: "36px", fontSize: "13px" }}
            />
            <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "var(--t3)", pointerEvents: "none" }}>$/kg</span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={row.grams}
              onChange={(e) => onChange("grams", e.target.value)}
              placeholder="Gramos"
              min="0"
              step="any"
              className="field-input"
              style={{ paddingRight: "24px", fontSize: "13px" }}
            />
            <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "var(--t3)", pointerEvents: "none" }}>g</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <p className="section-title">{title}</p>
          {hint && <span style={{ fontSize: "11px", color: "var(--t3)" }}>{hint}</span>}
        </div>
        {open ? <ChevronUp size={15} style={{ color: "var(--t3)" }} /> : <ChevronDown size={15} style={{ color: "var(--t3)" }} />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--t2)", display: "block", marginBottom: "5px" }}>
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          min="0"
          step="any"
          className="field-input"
          style={{ paddingRight: unit.length > 1 ? "40px" : "28px" }}
        />
        <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "var(--t3)", pointerEvents: "none" }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: active ? "var(--accent)" : "var(--page-bg)",
        color: active ? "white" : "var(--t2)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        fontSize: "13px",
      }}
    >
      {children}
    </button>
  );
}

function PresetBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-sm transition-colors"
      style={{
        background: active ? "var(--accent-bg)" : "var(--page-bg)",
        color: active ? "var(--accent)" : "var(--t2)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        fontSize: "12px",
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "6px" }}>
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ResultRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span style={{ fontSize: "12px", color: bold ? "var(--t2)" : "var(--t3)", fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: "12px", color: bold ? "var(--t1)" : "var(--t2)", fontWeight: bold ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
        $ {fmt(value)}
      </span>
    </div>
  );
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
