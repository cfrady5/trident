import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { executiveMetrics } from "@/lib/command/metrics";
import { Metric, NoData, PageTitle, Panel, dt, money, pct } from "@/components/command/ui";
import { CompleteTaskButton } from "@/components/command/actions";

export default async function CommandOverview() {
  const user = await requireStaff();
  const { m, tasks, activity } = await withUser(user.id, async (tx) => ({
    m: await executiveMetrics(tx),
    tasks: await tx<{ id: string; body: string; due_on: Date | null; company_id: string; company: string }[]>`
      select a.id, a.body, a.due_on, a.company_id, c.name as company from public.pipeline_activities a join public.companies c on c.id = a.company_id
      where a.kind = 'task' and a.completed_at is null order by a.due_on nulls last limit 8`,
    activity: await tx<{ id: string; body: string; kind: string; created_at: Date; company_id: string; company: string }[]>`
      select a.id, a.body, a.kind, a.created_at, a.company_id, c.name as company from public.pipeline_activities a join public.companies c on c.id = a.company_id
      order by a.created_at desc limit 10`,
  }));
  return (
    <>
      <PageTitle title="Overview" subtitle="Calculated from live records. Metrics without enough data say so." />
      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4 xl:grid-cols-6">
        <Metric label="Monthly recurring revenue" value={m.mrrCents == null ? <NoData /> : money(m.mrrCents)} note="Active engagements" />
        <Metric label="Active clients" value={m.activeClients} />
        <Metric label="Open opportunities" value={m.openOpportunities} href="/command/opportunities" />
        <Metric label="Qualified opportunities" value={m.qualifiedOpportunities} />
        <Metric label="Pipeline value" value={m.pipelineValueCents == null ? <NoData /> : money(m.pipelineValueCents)} note="Estimated, open" />
        <Metric label="Weighted pipeline" value={m.weightedPipelineCents == null ? <NoData /> : money(m.weightedPipelineCents)} note="× probability" />
        <Metric label="Average contract value" value={m.avgContractValueCents == null ? <NoData /> : money(m.avgContractValueCents)} note="Closed won" />
        <Metric label="Application → qualified" value={pct(m.submittedToQualified) ?? <NoData />} note="Shown from 5 applications" />
        <Metric label="Qualified → won" value={pct(m.qualifiedToWon) ?? <NoData />} note="Shown from 5 closed" />
        <Metric label="AI cost this month" value={`$${m.aiCostMonthUsd.toFixed(2)}`} note={`${m.aiExecutionsMonth} executions · estimate`} href="/command/automations" />
        <Metric label="Open deliverables" value={m.openDeliverables} note="Phase 4" />
        <Metric label="Pending approvals" value={m.pendingApprovals} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Needs attention">
          <ul className="space-y-2 text-caption">
            <li className="flex justify-between"><Link href="/command/applications?status=submitted" className="hover:text-gold-light">Applications awaiting review</Link><span className="font-mono">{m.applicationsAwaitingReview}</span></li>
            <li className="flex justify-between"><Link href="/command/applications" className="hover:text-gold-light">Files awaiting human review</Link><span className="font-mono">{m.filesAwaitingReview}</span></li>
            <li className="flex justify-between"><Link href="/command/intelligence" className="hover:text-gold-light">Research runs to review</Link><span className="font-mono">{m.reviewQueue}</span></li>
            <li className="flex justify-between"><Link href="/command/inquiries" className="hover:text-gold-light">New inquiries</Link><span className="font-mono">{m.newInquiries}</span></li>
            <li className="flex justify-between"><Link href="/command/automations" className="hover:text-gold-light">Failed jobs</Link><span className={m.failedJobs ? "font-mono text-danger" : "font-mono"}>{m.failedJobs}</span></li>
          </ul>
        </Panel>
        <Panel title="Open tasks">
          {tasks.length === 0 ? <p className="text-caption text-ivory-70">No open tasks.</p> : (
            <ul className="space-y-2 text-caption">{tasks.map((t) => <li key={t.id} className="flex items-start justify-between gap-3"><span><Link href={`/command/companies/${t.company_id}`} className="text-ivory-70 hover:text-ivory">{t.company}</Link> · {t.body}{t.due_on && <span className="ml-1 text-ivory-50">due {dt(t.due_on)}</span>}</span><CompleteTaskButton id={t.id} /></li>)}</ul>
          )}
        </Panel>
        <Panel title="Recent activity">
          {activity.length === 0 ? <p className="text-caption text-ivory-70">No pipeline activity yet.</p> : (
            <ul className="space-y-2 text-caption">{activity.map((a) => <li key={a.id}><Link href={`/command/companies/${a.company_id}`} className="text-ivory hover:text-gold-light">{a.company}</Link> <span className="text-ivory-70">· {a.body}</span> <span className="text-ivory-50">{dt(a.created_at)}</span></li>)}</ul>
          )}
        </Panel>
      </div>
    </>
  );
}
