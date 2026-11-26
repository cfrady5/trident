import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PageTitle, Panel, dt } from "@/components/command/ui";
import { Pill } from "@/components/ui/primitives";
import { RunReview } from "@/components/command/actions";
import { PUBLIC_SOURCES } from "@/lib/intelligence/sources";

export const metadata = { title: "Intelligence" };

type Step = { key: string; label: string; status: string; detail: string; data?: unknown };

export default async function IntelligencePage() {
  const user = await requireStaff();
  const runs = await withUser(user.id, (tx) => tx<{ id: string; status: string; company_id: string | null; company: string | null; steps: Step[]; created_at: Date; finished_at: Date | null }[]>`
    select r.id, r.status, r.company_id, c.name as company, r.steps, r.created_at, r.finished_at
    from public.automation_runs r left join public.companies c on c.id = r.company_id
    where r.workflow_key like 'research.%' order by (r.status = 'needs_review') desc, r.created_at desc limit 50`);
  return (
    <>
      <PageTitle title="Intelligence" subtitle="Research findings are internal hypotheses until a strategist reviews them. Nothing here is client-facing." />
      <div className="space-y-4">
        {runs.length === 0 && <p className="border border-dashed border-line p-8 text-center text-caption text-ivory-70">No research runs yet. Research starts automatically after an application is submitted and the job worker runs.</p>}
        {runs.map((r) => (
          <Panel key={r.id} title={`${r.company ?? "Unknown"} · ${dt(r.created_at)}`} actions={<span className="flex items-center gap-3"><Pill tone={r.status === "needs_review" ? "warn" : r.status === "approved" ? "ok" : "neutral"}>{r.status.replace(/_/g, " ")}</Pill>{r.status === "needs_review" && <RunReview id={r.id} />}</span>}>
            <ul className="divide-y divide-line text-[13px]">{r.steps.map((s) => (
              <li key={s.key} className="grid gap-1 py-2 sm:grid-cols-[150px_1fr]">
                <span className={s.status === "succeeded" ? "text-success" : s.status === "flagged" || s.status === "failed" ? "text-gold" : "text-ivory-50"}>{s.status.replace(/_/g, " ")}</span>
                <span><span className="font-medium">{s.label}</span><span className="block text-ivory-70">{s.detail}</span>
                  {s.key === "ai_messaging" && s.data != null && <pre className="mt-2 overflow-x-auto bg-carbon p-2 text-[11px] text-ivory-70">{JSON.stringify(s.data, null, 2)}</pre>}
                </span>
              </li>
            ))}</ul>
            {r.company_id && <Link href={`/command/companies/${r.company_id}`} className="mt-3 inline-block text-[13px] text-gold-light">Open company profile →</Link>}
          </Panel>
        ))}
      </div>
      <Panel title="Public data source adapters" className="mt-8">
        <ul className="divide-y divide-line text-[13px]">{PUBLIC_SOURCES.map((s) => <li key={s.key} className="flex justify-between gap-4 py-2"><span>{s.name}<span className="block text-[12px] text-ivory-50">{s.officialAccess}</span></span><span className="text-ivory-50">{s.status.replace("_", " ")}</span></li>)}</ul>
      </Panel>
    </>
  );
}
