import { useMemo } from "react";

export interface FilamentRow {
  id: string;
  filamentId: number | null;
  label: string;
  pricePerKg: string;
  grams: string;
}

export interface MaterialRow {
  id: string;
  name: string;
  price: string;
}

export interface CalculatorState {
  filaments: FilamentRow[];
  printHours: string;
  printMinutes: string;
  wattage: string;
  kwHPrice: string;
  lifeHours: string;
  partsPrice: string;
  errorMarginPct: string;
  externalMaterials: MaterialRow[];
  fixedCosts: string;
  profitMode: "multiplier" | "percentage";
  profitValue: string;
  commissionPct: string;
}

export interface CalculatorResult {
  filamentCost: number;
  electricityCost: number;
  wearCost: number;
  materialsCost: number;
  productionCost: number;
  totalCost: number;
  salePrice: number;
  salePriceWithFee: number;
  profit: number;
  printHoursTotal: number;
}

export function useCalculator(state: CalculatorState): CalculatorResult {
  return useMemo(() => {
    const n = (v: string) => parseFloat(v) || 0;

    const filamentCost = state.filaments.reduce((sum, f) => {
      const pkgPrice = n(f.pricePerKg);
      const grams = n(f.grams);
      return sum + (pkgPrice / 1000) * grams;
    }, 0);

    const printHoursTotal = n(state.printHours) + n(state.printMinutes) / 60;
    const electricityCost = (n(state.wattage) / 1000) * printHoursTotal * n(state.kwHPrice);
    const wearCost = n(state.lifeHours) > 0
      ? (n(state.partsPrice) / n(state.lifeHours)) * printHoursTotal
      : 0;

    const materialsCost = state.externalMaterials.reduce((sum, m) => sum + n(m.price), 0);

    const baseCost = filamentCost + electricityCost + wearCost + materialsCost;
    const productionCost = baseCost * (1 + n(state.errorMarginPct) / 100);

    const fixedCosts = n(state.fixedCosts);
    const totalCost = productionCost + fixedCosts;

    let salePrice: number;
    if (state.profitMode === "multiplier") {
      salePrice = totalCost * n(state.profitValue);
    } else {
      salePrice = totalCost * (1 + n(state.profitValue) / 100);
    }

    const commission = n(state.commissionPct);
    const salePriceWithFee = commission > 0 && commission < 100
      ? salePrice / (1 - commission / 100)
      : salePrice;

    const profit = salePrice - totalCost;

    return {
      filamentCost,
      electricityCost,
      wearCost,
      materialsCost,
      productionCost,
      totalCost,
      salePrice,
      salePriceWithFee,
      profit,
      printHoursTotal,
    };
  }, [state]);
}

export function defaultState(): CalculatorState {
  return {
    filaments: [{ id: "1", filamentId: null, label: "", pricePerKg: "", grams: "" }],
    printHours: "",
    printMinutes: "",
    wattage: "65",
    kwHPrice: "",
    lifeHours: "5000",
    partsPrice: "",
    errorMarginPct: "15",
    externalMaterials: [],
    fixedCosts: "",
    profitMode: "multiplier",
    profitValue: "4",
    commissionPct: "",
  };
}

// Converts a saved ProductQuote (DB row) to CalculatorState for pre-loading the calculator
export function quoteToState(quote: {
  filamentsData: string;
  printHours: number;
  printMinutes: number;
  wattage: number;
  kwHPrice: number;
  lifeHours: number;
  partsPrice: number;
  errorMarginPct: number;
  externalMaterials: string;
  fixedCosts: number;
  profitMode: string;
  profitValue: number;
  commissionPct: number;
}): CalculatorState {
  let filamentRows: FilamentRow[] = [];
  let materialRows: MaterialRow[] = [];

  try {
    const fData: { filamentId: number | null; label: string; pricePerKg: number; grams: number }[] =
      JSON.parse(quote.filamentsData);
    filamentRows = fData.map((f) => ({
      id: Math.random().toString(36).slice(2),
      filamentId: f.filamentId,
      label: f.label,
      pricePerKg: f.pricePerKg > 0 ? String(f.pricePerKg) : "",
      grams: f.grams > 0 ? String(f.grams) : "",
    }));
  } catch {}

  try {
    const mData: { name: string; price: number }[] = JSON.parse(quote.externalMaterials);
    materialRows = mData.map((m) => ({
      id: Math.random().toString(36).slice(2),
      name: m.name,
      price: m.price > 0 ? String(m.price) : "",
    }));
  } catch {}

  return {
    filaments: filamentRows.length > 0
      ? filamentRows
      : [{ id: "1", filamentId: null, label: "", pricePerKg: "", grams: "" }],
    printHours:      quote.printHours > 0   ? String(quote.printHours)      : "",
    printMinutes:    quote.printMinutes > 0  ? String(quote.printMinutes)    : "",
    wattage:         String(quote.wattage),
    kwHPrice:        quote.kwHPrice > 0      ? String(quote.kwHPrice)        : "",
    lifeHours:       String(quote.lifeHours),
    partsPrice:      quote.partsPrice > 0    ? String(quote.partsPrice)      : "",
    errorMarginPct:  String(quote.errorMarginPct),
    externalMaterials: materialRows,
    fixedCosts:      quote.fixedCosts > 0    ? String(quote.fixedCosts)      : "",
    profitMode:      (quote.profitMode as "multiplier" | "percentage") ?? "multiplier",
    profitValue:     String(quote.profitValue),
    commissionPct:   quote.commissionPct > 0 ? String(quote.commissionPct)   : "",
  };
}

export function buildSummary(name: string, state: CalculatorState, result: CalculatorResult): string {
  const f = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sep = "─".repeat(30);
  const lines: string[] = [];

  if (name) lines.push(`📦 ${name}`);
  lines.push(sep);

  state.filaments.forEach((fil, i) => {
    const cost = (parseFloat(fil.pricePerKg) / 1000) * (parseFloat(fil.grams) || 0);
    lines.push(`${fil.label || `Filamento ${i + 1}`} (${fil.grams || 0}g): $${f(cost)}`);
  });

  lines.push(`Electricidad: $${f(result.electricityCost)}`);
  lines.push(`Desgaste impresora: $${f(result.wearCost)}`);
  state.externalMaterials.forEach((m) => {
    if (m.name) lines.push(`${m.name}: $${f(parseFloat(m.price) || 0)}`);
  });

  const errorCost = result.productionCost - result.filamentCost - result.electricityCost - result.wearCost - result.materialsCost;
  lines.push(`Margen de error (${state.errorMarginPct}%): $${f(errorCost)}`);
  lines.push(sep);
  lines.push(`Costo de producción: $${f(result.productionCost)}`);
  if (parseFloat(state.fixedCosts) > 0) lines.push(`Insumos fijos: $${f(parseFloat(state.fixedCosts))}`);
  lines.push(`Total de costos: $${f(result.totalCost)}`);
  lines.push(sep);

  const profitLabel = state.profitMode === "multiplier"
    ? `×${state.profitValue} sobre costo`
    : `+${state.profitValue}% sobre costo`;
  lines.push(`💰 Precio de venta (${profitLabel}): $${f(result.salePrice)}`);
  if (parseFloat(state.commissionPct) > 0) {
    lines.push(`🛒 Con comisión (${state.commissionPct}%): $${f(result.salePriceWithFee)}`);
  }

  return lines.join("\n");
}
