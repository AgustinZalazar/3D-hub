import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const jobs = await p.printJob.findMany({
  orderBy: { id: "desc" },
  take: 5,
  select: { id: true, fileName: true, status: true, pendingDeduction: true, finishedAt: true }
});
console.log(JSON.stringify(jobs, null, 2));

const filaments = await p.filament.findMany({
  where: { isActive: true },
  select: { id: true, brand: true, material: true, color: true, colorHex: true }
});
console.log("Active filaments:", JSON.stringify(filaments, null, 2));

await p.$disconnect();
