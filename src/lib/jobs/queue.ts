/**
 * Durable Postgres job queue. Jobs survive restarts and browser sessions,
 * are claimed with FOR UPDATE SKIP LOCKED, retried with exponential backoff and
 * moved to `dead` after max_attempts. Stale `running` jobs (worker crashed or
 * exceeded timeout) are reclaimed. Every job has a unique idempotency key.
 *
 * Execution: Vercel Cron -> POST /api/jobs/run (CRON_SECRET), or `npm run worker`.
 */
import type { Tx } from "../db";

export const JOB_KINDS = [
  "notify.application_submitted",
  "research.initial",
] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export interface JobRow {
  id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  timeout_seconds: number;
}

export async function enqueueJob(
  tx: Tx,
  j: { kind: JobKind; payload: Record<string, unknown>; idempotencyKey: string; eventId?: string; runAt?: Date; priority?: number; maxAttempts?: number; timeoutSeconds?: number },
): Promise<string | null> {
  const rows = await tx<{ id: string }[]>`
    insert into public.jobs (kind, payload, idempotency_key, event_id, run_at, priority, max_attempts, timeout_seconds)
    values (${j.kind}, ${tx.json(j.payload as never)}, ${j.idempotencyKey}, ${j.eventId ?? null}, ${j.runAt ?? new Date()},
            ${j.priority ?? 100}, ${j.maxAttempts ?? 5}, ${j.timeoutSeconds ?? 300})
    on conflict (idempotency_key) do nothing
    returning id`;
  return rows[0]?.id ?? null;
}

export async function reclaimStale(tx: Tx): Promise<number> {
  const rows = await tx`
    update public.jobs set
      status = case when attempts >= max_attempts then 'dead' else 'queued' end,
      locked_at = null, locked_by = null,
      last_error = coalesce(last_error, '') || ' [reclaimed after timeout]',
      finished_at = case when attempts >= max_attempts then now() else null end
    where status = 'running' and locked_at < now() - make_interval(secs => timeout_seconds + 60)
    returning id`;
  return rows.length;
}

export async function claimJobs(tx: Tx, workerId: string, limit: number): Promise<JobRow[]> {
  return tx<JobRow[]>`
    update public.jobs set status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    where id in (
      select id from public.jobs
      where status = 'queued' and run_at <= now()
      order by priority, run_at
      limit ${limit}
      for update skip locked)
    returning id, kind, payload, attempts, max_attempts, timeout_seconds`;
}

export async function completeJob(tx: Tx, id: string, result: unknown): Promise<void> {
  await tx`update public.jobs set status = 'succeeded', result = ${tx.json((result ?? {}) as never)}, finished_at = now(), locked_at = null, last_error = null where id = ${id}`;
}

/** Backoff: 30s, 60s, 120s ... capped at 1 hour. */
export function backoffSeconds(attempts: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
}

export async function failJob(tx: Tx, job: Pick<JobRow, "id" | "attempts" | "max_attempts">, error: string, retryable = true): Promise<"queued" | "dead"> {
  const dead = !retryable || job.attempts >= job.max_attempts;
  await tx`
    update public.jobs set
      status = ${dead ? "dead" : "queued"},
      last_error = ${error.slice(0, 2000)},
      run_at = now() + make_interval(secs => ${backoffSeconds(job.attempts)}),
      locked_at = null, locked_by = null,
      finished_at = ${dead ? new Date() : null}
    where id = ${job.id}`;
  return dead ? "dead" : "queued";
}

/** Staff action: requeue a dead/failed job (audited by the caller). */
export async function retryJob(tx: Tx, id: string): Promise<void> {
  await tx`update public.jobs set status = 'queued', attempts = 0, run_at = now(), finished_at = null, last_error = null
           where id = ${id} and status in ('dead', 'failed', 'cancelled')`;
}
