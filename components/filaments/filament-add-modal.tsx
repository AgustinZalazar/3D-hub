"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { AddFilamentForm } from "./add-filament-form";

export function FilamentAddModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg text-sm font-medium"
        style={{
          background: "var(--accent)",
          color: "oklch(0.98 0.004 288)",
          padding: "8px 16px",
          transition: "opacity 150ms var(--ease-out)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <Plus size={14} strokeWidth={2.2} />
        Agregar filamento
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ animation: "backdrop-in 150ms var(--ease-out)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "oklch(0.145 0.015 265 / 0.30)", backdropFilter: "blur(2px)" }}
          />
          <div
            className="relative w-full"
            style={{ maxWidth: "440px", animation: "modal-in 200ms var(--ease-out)" }}
          >
            <AddFilamentForm onSuccess={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
