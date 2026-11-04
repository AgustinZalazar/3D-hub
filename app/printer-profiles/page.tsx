import { prisma } from "@/lib/db/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrinterProfileList } from "@/components/printer-profiles/printer-profile-list";
import { PrinterProfileCreateForm } from "@/components/printer-profiles/printer-profile-create-form";

export default async function PrinterProfilesPage() {
  const profiles = await prisma.printerProfile.findMany({ orderBy: { isDefault: "desc" } });

  return (
    <div style={{ maxWidth: "680px" }}>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/calculator"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--t3)" }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1
            className="font-semibold tracking-tight"
            style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}
          >
            Perfiles de impresora
          </h1>
          <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
            Guardá la configuración de consumo de tu impresora para reutilizarla en la calculadora
          </p>
        </div>
      </div>

      <PrinterProfileCreateForm />

      {profiles.length > 0 && (
        <div className="mt-4">
          <PrinterProfileList profiles={profiles} />
        </div>
      )}
    </div>
  );
}
