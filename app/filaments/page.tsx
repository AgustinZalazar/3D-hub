import { prisma } from "@/lib/db/client";
import { FilamentList } from "@/components/filaments/filament-list";
import { FilamentAddModal } from "@/components/filaments/filament-add-modal";

export default async function FilamentsPage() {
  const filaments = await prisma.filament.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { printJobs: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1
          className="font-semibold tracking-tight"
          style={{ fontSize: "24px", letterSpacing: "-0.02em", color: "var(--t1)" }}
        >
          Filamentos
        </h1>
        <FilamentAddModal />
      </div>

      <FilamentList filaments={filaments} />
    </div>
  );
}
