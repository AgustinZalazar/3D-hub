import { readAllModels } from "@/lib/gcode/reader";
import { ModelGrid } from "@/components/models/model-grid";
import { FolderOpen } from "lucide-react";

export default function ModelsPage() {
  const folder = process.env.GCODE_FOLDER ?? "";
  const models = folder ? readAllModels(folder) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-semibold tracking-tight"
            style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}
          >
            Modelos
          </h1>
          {folder && models.length > 0 && (
            <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
              {models.length} archivos · {folder}
            </p>
          )}
        </div>
      </div>

      {!folder && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen size={32} strokeWidth={1.2} style={{ color: "var(--border)", marginBottom: "12px" }} />
          <p style={{ fontWeight: 500, color: "var(--t2)", marginBottom: "4px" }}>
            Carpeta no configurada
          </p>
          <p style={{ fontSize: "13px", color: "var(--t3)" }}>
            Agregá <code style={{ fontSize: "12px", background: "var(--page-bg)", padding: "1px 6px", borderRadius: "4px", border: "1px solid var(--border)" }}>GCODE_FOLDER=C:\ruta</code> a tu archivo <code>.env</code>
          </p>
        </div>
      )}

      {folder && <ModelGrid models={models} />}
    </div>
  );
}
