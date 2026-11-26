import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { EVENT_CATALOG } from "@/lib/events";
import { PageTitle, Panel, Table, Td, Th, dt } from "@/components/command/ui";
import { Pill } from "@/components/ui/primitives";
import { RetryJobButton } from "@/components/command/actions";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const user = await requireStaff();
  const d = await withUser(user.id, async (tx) => ({
    jobs: await tx<{ id: string; kind: string; status: string; attempts: number; max_attempts: number; run_at: Date; last_error: string | null; created_at: Date; finished_at: Date | null }[]>`
      select id, kind, status, attempts, max_attempts, run_at, last_error, created_at, finished_at from public.jobs order by created_at desc limit 100`,
    events: await tx<{ name: string; n: number; last: Date }[]>`select name, count(*)::int as n, max(occurred_at) as last from public.domain_events group by name`,
    ai: await tx<{ model: string; n: number; input: number; output: number; cost: string; failed: number }[]>`
      select model, count(*)::int as n, sum(input_tokens)::int as input, sum(output_tokens)::int as output, sum(estimated_cost_usd)::text as cost,
             count(*) filter (where status <> 'succeeded')::int as failed
      from public.ai_executions where created_at >= date_trunc('month', now()) group by model`,
  }));
  const tone = (s: string) => (s === "succeeded" ? "ok" : s === "dead" || s === "failed" ? "danger" : s === "running" ? "gold" : "neutral") as "ok";
  return (
    <>
      <PageTitle title="Automations" subtitle="Domain events, durable jobs and AI usage. Events are idempotent; jobs retry with backoff and stop after their attempt limit." />
      <Panel title="Jobs">
        {d.jobs.length === 0 ? <p className="text-[13px] text-ivory-70">No jobs yet.</p> : (
          <Table className="border-0">
            <thead><tr><Th>Created</Th><Th>Kind</Th><Th>Status</Th><Th>Attempts</Th><Th>Next run / finished</Th><Th>Last error</Th><Th></Th></tr></thead>
            <tbody>{d.jobs.map((j) => (
              <tr key={j.id}><Td className="text-ivory-70">{dt(j.created_at)}</Td><Td className="font-mono text-[12px]">{j.kind}</Td><Td><Pill tone={tone(j.status)}>{j.status}</Pill></Td>
                <Td className="font-mono">{j.attempts}/{j.max_attempts}</Td><Td className="text-ivory-70">{j.finished_at ? dt(j.finished_at) : j.run_at.toLocaleString()}</Td>
                <Td className="max-w-xs truncate text-[12px] text-danger" >{j.last_error}</Td><Td>{(j.status === "dead" || j.status === "failed") && <RetryJobButton id={j.id} />}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Panel>
      <Panel title="AI usage this month (estimated cost)" className="mt-6">
        {d.ai.length === 0 ? <p className="text-[13px] text-ivory-70">No AI executions. {process.env.AI_PROVIDER === "anthropic" ? "" : "AI is not configured (AI_PROVIDER=none); AI steps are recorded as blocked."}</p> : (
          <ul className="text-[13px]">{d.ai.map((a) => <li key={a.model} className="flex justify-between border-b border-line py-2"><span className="font-mono">{a.model}</span><span>{a.n} calls · {a.input.toLocaleString()} in / {a.output.toLocaleString()} out · ${Number(a.cost).toFixed(4)}{a.failed > 0 && <span className="text-danger"> · {a.failed} failed</span>}</span></li>)}</ul>
        )}
      </Panel>
      <Panel title="Event catalog" className="mt-6">
        <Table className="border-0">
          <thead><tr><Th>Event</Th><Th>Phase</Th><Th>Producer</Th><Th>Triggers</Th><Th>Approval</Th><Th>Emitted</Th></tr></thead>
          <tbody>{EVENT_CATALOG.map((e) => {
            const c = d.events.find((x) => x.name === e.name);
            return (
              <tr key={e.name}><Td className="font-mono text-[12px]">{e.name}</Td><Td className="font-mono">P{e.phase}</Td><Td className="text-[12px] text-ivory-70">{e.producer}</Td>
                <Td className="text-[12px]">{e.jobs.length ? e.jobs.join(", ") : <span className="text-ivory-50">{"planned" in e ? `planned: ${e.planned}` : "none"}</span>}</Td>
                <Td className="text-[12px] text-ivory-70">{e.approval}</Td><Td className="font-mono">{c ? `${c.n} · ${dt(c.last)}` : "—"}</Td></tr>
            );
          })}</tbody>
        </Table>
      </Panel>
    </>
  );
}
