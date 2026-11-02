import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const pending = [
  { colorHex: "#000000", grams: 0, filamentId: 2, filamentLabel: "Bambulab PLA — Lite Negro", editable: true },
  { colorHex: "#ffffff", grams: 0, filamentId: 3, filamentLabel: "Filalab PLA — Blanco HighSpeed", editable: true },
];

await p.printJob.update({
  where: { id: 4 },
  data: { pendingDeduction: JSON.stringify(pending) },
});

console.log("Pending deduction set for job 4 — open the app to confirm.");
await p.$disconnect();
