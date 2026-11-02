import { prisma } from "@/lib/db/client";
import { IssueList } from "@/components/issues/issue-list";
import { AddIssueForm } from "@/components/issues/add-issue-form";

export default async function IssuesPage() {
  const issues = await prisma.issue.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      printJob: { select: { fileName: true } },
    },
  });

  const open = issues.filter((i) => i.status === "open").length;
  const tracking = issues.filter((i) => i.status === "tracking").length;
  const resolved = issues.filter((i) => i.status === "resolved").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Issues</h1>
        <div className="flex gap-3 text-xs text-[var(--muted)]">
          <span><span className="text-red-400 font-medium">{open}</span> abiertos</span>
          <span><span className="text-amber-400 font-medium">{tracking}</span> en seguimiento</span>
          <span><span className="text-[var(--muted)] font-medium">{resolved}</span> resueltos</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <IssueList issues={issues} />
        </div>
        <div>
          <AddIssueForm />
        </div>
      </div>
    </div>
  );
}
