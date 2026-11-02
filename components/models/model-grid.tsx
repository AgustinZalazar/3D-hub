"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { Search, FolderOpen, ExternalLink, Tag, X, Plus } from "lucide-react";
import type { ModelMetadata } from "@/lib/gcode/reader";

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatSize(bytes: number) {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;
}
function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}
function cleanName(fileName: string) {
  return fileName.replace(/\.3mf$/i, "").replace(/[_-]/g, " ");
}

type SortKey = "newest" | "oldest" | "name" | "size";

// ── Tag manager per card ─────────────────────────────────────────────────────

function TagManager({ fileName, allTags }: { fileName: string; allTags: string[] }) {
  const [tags, setTags] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/models/tags?file=${encodeURIComponent(fileName)}`)
      .then((r) => r.json())
      .then(setTags)
      .catch(() => {});
  }, [fileName]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function addTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    await fetch("/api/models/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, tag: t }),
    });
    setTags((prev) => [...prev, t].sort());
    setInput("");
  }

  async function removeTag(tag: string) {
    await fetch("/api/models/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, tag }),
    });
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  // Suggestions: existing tags not yet assigned to this model
  const suggestions = allTags.filter((t) => !tags.includes(t) && t.includes(input.toLowerCase()));

  return (
    <div style={{ position: "relative" }}>
      {/* Tags row */}
      <div className="flex items-center gap-1 flex-wrap" style={{ minHeight: "22px" }}>
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 px-2 py-px rounded-full"
            style={{
              fontSize: "10px",
              fontWeight: 500,
              background: "var(--accent-bg)",
              color: "var(--accent-text)",
              border: "1px solid var(--accent-border)",
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              style={{ color: "var(--accent-text)", lineHeight: 1, cursor: "pointer", background: "none", border: "none", padding: 0 }}
            >
              <X size={9} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-0.5 px-1.5 py-px rounded-full transition-colors"
          style={{
            fontSize: "10px",
            color: "var(--t3)",
            border: "1px dashed var(--border)",
            background: "transparent",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-border)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <Plus size={9} strokeWidth={2.5} />
          tag
        </button>
      </div>

      {/* Input popover */}
      {open && (
        <div
          className="card absolute z-20 p-2"
          style={{ top: "calc(100% + 6px)", left: 0, minWidth: "180px", boxShadow: "var(--shadow-lg)" }}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
          tabIndex={-1}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { addTag(input); }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Nueva categoría..."
            className="field-input"
            style={{ fontSize: "12px", padding: "6px 10px" }}
          />
          {suggestions.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s}
                  onClick={() => addTag(s)}
                  className="w-full text-left px-2 py-1 rounded-md text-xs transition-colors"
                  style={{ color: "var(--t2)", background: "transparent", cursor: "pointer", border: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--page-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main grid ────────────────────────────────────────────────────────────────

export function ModelGrid({ models }: { models: ModelMetadata[] }) {
  const [search, setSearch] = useState("");
  const [material, setMaterial] = useState("all");
  const [activeTag, setActiveTag] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [tagMap, setTagMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch("/api/models/tags")
      .then((r) => r.json())
      .then(setTagMap)
      .catch(() => {});
  }, []);

  const allMaterials = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => m.filaments.forEach((f) => set.add(f.material)));
    return Array.from(set).sort();
  }, [models]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    Object.values(tagMap).flat().forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [tagMap]);

  const filtered = useMemo(() => {
    let result = [...models];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) => cleanName(m.fileName).toLowerCase().includes(q));
    }
    if (material !== "all") {
      result = result.filter((m) => m.filaments.some((f) => f.material === material));
    }
    if (activeTag !== "all") {
      result = result.filter((m) => (tagMap[m.fileName] ?? []).includes(activeTag));
    }

    result.sort((a, b) => {
      if (sort === "newest") return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      if (sort === "oldest") return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      if (sort === "name")   return a.fileName.localeCompare(b.fileName);
      if (sort === "size")   return b.sizeBytes - a.sizeBytes;
      return 0;
    });

    return result;
  }, [models, search, material, activeTag, sort, tagMap]);

  const filterPill = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--accent-bg)" : "var(--card-bg)",
        color: active ? "var(--accent-text)" : "var(--t3)",
        border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1" style={{ minWidth: "180px", maxWidth: "280px" }}>
            <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Buscar modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-input"
              style={{ paddingLeft: "30px", fontSize: "13px" }}
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="field-input"
            style={{ width: "auto", fontSize: "13px", paddingRight: "28px", cursor: "pointer", marginLeft: "auto" }}
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="name">Nombre A–Z</option>
            <option value="size">Tamaño</option>
          </select>
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag size={12} strokeWidth={1.8} style={{ color: "var(--t3)", marginRight: "2px" }} />
            {filterPill("Todos", activeTag === "all", () => setActiveTag("all"))}
            {allTags.map((t) => filterPill(t, activeTag === t, () => setActiveTag(t)))}
          </div>
        )}

        {/* Material filters */}
        {allMaterials.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterPill("Todos", material === "all", () => setMaterial("all"))}
            {allMaterials.map((m) => filterPill(m, material === m, () => setMaterial(m)))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen size={32} strokeWidth={1.2} style={{ color: "var(--border)", marginBottom: "12px" }} />
          <p style={{ fontWeight: 500, color: "var(--t2)" }}>Sin resultados</p>
          <p style={{ fontSize: "13px", color: "var(--t3)", marginTop: "4px" }}>Probá con otro nombre o filtro.</p>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {filtered.map((model) => {
            const thumbUrl = model.thumbnailEntry
              ? `/api/models/thumbnail?file=${encodeURIComponent(model.fileName)}&entry=${encodeURIComponent(model.thumbnailEntry)}`
              : null;

            return (
              <div key={model.fileName} className="card overflow-hidden flex flex-col">
                {/* Thumbnail */}
                <div
                  className="relative flex items-center justify-center"
                  style={{ height: "160px", background: "var(--page-bg)", borderBottom: "1px solid var(--border-subtle)" }}
                >
                  {thumbUrl ? (
                    <Image src={thumbUrl} alt={cleanName(model.fileName)} fill className="object-contain p-3" unoptimized />
                  ) : (
                    <FolderOpen size={36} strokeWidth={1.2} style={{ color: "var(--border)" }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col flex-1 px-4 py-3 gap-2.5">
                  <div>
                    <p className="font-semibold leading-tight" style={{ fontSize: "13px", color: "var(--t1)", letterSpacing: "-0.01em" }} title={model.fileName}>
                      {cleanName(model.fileName)}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "2px" }}>
                      {formatDate(model.modifiedAt)} · {formatSize(model.sizeBytes)}
                    </p>
                  </div>

                  {/* Tags */}
                  <TagManager
                    fileName={model.fileName}
                    allTags={allTags}
                  />

                  {/* Filament colors */}
                  {model.filaments.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {model.filaments.map((f, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="rounded-full flex-shrink-0" style={{ width: "10px", height: "10px", background: f.colorHex, border: "1.5px solid var(--border)" }} title={`${f.material} ${f.colorHex} · ${f.grams.toFixed(1)}g`} />
                          <span className="num-tabular" style={{ fontSize: "11px", color: "var(--t3)" }}>{f.grams.toFixed(0)}g</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stats + open */}
                  <div className="flex items-center gap-2 pt-2 mt-auto" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <span className="num-tabular" style={{ fontSize: "12px", color: "var(--t2)", fontWeight: 500 }}>
                      {model.totalGrams > 0 ? `${model.totalGrams.toFixed(0)}g` : "—"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--t3)" }}>
                      {model.estimatedSeconds ? formatTime(model.estimatedSeconds) : "—"}
                    </span>
                    {model.layerHeight && (
                      <span style={{ fontSize: "11px", color: "var(--t3)" }}>{model.layerHeight}mm</span>
                    )}
                    <button
                      onClick={() => fetch("/api/models/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: model.fileName }) })}
                      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors"
                      style={{ fontSize: "11px", color: "var(--t2)", border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}
                      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--accent-bg)"; el.style.color = "var(--accent-text)"; el.style.borderColor = "var(--accent-border)"; }}
                      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--t2)"; el.style.borderColor = "var(--border)"; }}
                    >
                      <ExternalLink size={11} strokeWidth={2} />
                      Abrir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
