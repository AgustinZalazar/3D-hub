"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function ProductDeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar esta cotización?")) return;
    setLoading(true);
    await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 rounded-md transition-colors flex-shrink-0"
      style={{ color: "var(--t3)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t3)")}
      title="Eliminar"
    >
      <Trash2 size={14} />
    </button>
  );
}
