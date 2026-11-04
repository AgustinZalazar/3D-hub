import { prisma } from "@/lib/db/client";
import { readAllModels } from "@/lib/gcode/reader";
import { CalculatorClient } from "@/components/calculator/calculator-client";
import { quoteToState } from "@/lib/calculator/use-calculator";

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>;
}) {
  const { quote: quoteId } = await searchParams;

  const [filaments, printerProfiles] = await Promise.all([
    prisma.filament.findMany({ where: { isActive: true }, orderBy: { brand: "asc" } }),
    prisma.printerProfile.findMany({ orderBy: { isDefault: "desc" } }),
  ]);

  const folder = process.env.GCODE_FOLDER ?? "";
  const models = folder ? readAllModels(folder) : [];

  // Load saved quote if requested
  let initialData: { quoteId: number; quoteName: string; state: ReturnType<typeof quoteToState>; selectedModels: string[] } | null = null;
  if (quoteId) {
    const quote = await prisma.productQuote.findUnique({ where: { id: parseInt(quoteId) } });
    if (quote) {
      const selectedModels: string[] = (() => {
        try { return JSON.parse(quote.modelFiles ?? "[]"); } catch { return []; }
      })();
      initialData = {
        quoteId: quote.id,
        quoteName: quote.name,
        state: quoteToState(quote),
        selectedModels,
      };
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-semibold tracking-tight"
            style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}
          >
            Calculadora de costos
          </h1>
          <p style={{ fontSize: "12px", color: "var(--t3)", marginTop: "2px" }}>
            {initialData
              ? `Editando cotización: ${initialData.quoteName}`
              : "Calculá el precio de venta de tus productos"}
          </p>
        </div>
      </div>

      <CalculatorClient
        filaments={filaments}
        printerProfiles={printerProfiles}
        models={models.map((m) => ({
          fileName: m.fileName,
          thumbnailEntry: m.thumbnailEntry,
          totalGrams: m.totalGrams,
          estimatedSeconds: m.estimatedSeconds,
          filaments: m.filaments,
          plates: m.plates,
          dataSource: m.dataSource,
        }))}
        initialData={initialData}
      />
    </div>
  );
}
