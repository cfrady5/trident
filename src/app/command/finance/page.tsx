import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { Metric, NoData, PageTitle, Panel, money } from "@/components/command/ui";
import { ScenarioModel } from "@/components/command/scenario";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const user = await requireStaff();
  const [f] = await withUser(user.id, (tx) => tx<Record<string, string | null>[]>`
    select
      (select sum(monthly_fee_cents) from public.engagements where status = 'active')::text as recurring,
      (select sum(one_time_fee_cents) from public.engagements where status in ('active','completed'))::text as one_time,
      (select sum(amount_paid_cents) from public.invoices where status = 'paid')::text as paid,
      (select sum(amount_due_cents - amount_paid_cents) from public.invoices where status = 'open')::text as outstanding,
      (select sum(minutes) from public.time_entries where worked_on >= date_trunc('month', now()))::text as minutes,
      (select coalesce(sum(estimated_cost_usd), 0) from public.ai_executions where created_at >= date_trunc('month', now()))::text as ai`);
  const n = (k: string) => (f?.[k] == null ? null : Number(f[k]));
  return (
    <>
      <PageTitle title="Finance" subtitle="Actuals from engagements, invoices, time entries and AI executions. Billing records arrive with the Stripe integration in Phase 3." />
      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Recurring revenue (MRR)" value={n("recurring") == null ? <NoData /> : money(n("recurring"))} />
        <Metric label="One-time revenue" value={n("one_time") == null ? <NoData /> : money(n("one_time"))} />
        <Metric label="Paid invoices" value={n("paid") == null ? <NoData /> : money(n("paid"))} />
        <Metric label="Outstanding" value={n("outstanding") == null ? <NoData /> : money(n("outstanding"))} />
        <Metric label="Labor this month" value={n("minutes") == null ? <NoData /> : `${(n("minutes")! / 60).toFixed(1)} h`} />
        <Metric label="AI cost this month" value={`$${(n("ai") ?? 0).toFixed(2)}`} note="Estimate" />
      </div>
      <Panel title="Capacity and profitability scenario" className="mt-6">
        <p className="mb-4 text-[13px] text-ivory-70">Planning assumptions, not measured performance. The 85% labor reduction is aspirational. Real margins come from tracked production time, AI costs, revisions and review time once engagements run.</p>
        <ScenarioModel />
      </Panel>
    </>
  );
}
