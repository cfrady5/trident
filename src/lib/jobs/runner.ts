import { withSystem } from "../db";
import { log } from "../errors";
import { claimJobs, completeJob, failJob, reclaimStale, type JobRow } from "./queue";
import { HANDLERS } from "./handlers";

export interface RunSummary {
  claimed: number;
  succeeded: number;
  retried: number;
  dead: number;
  reclaimed: number;
}

function withTimeout<T>(p: Promise<T>, seconds: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${seconds}s`)), seconds * 1000))]);
}

/** Processes ready jobs until none remain, `limit` is reached or the time budget is spent. */
export async function runJobs(opts: { workerId: string; limit?: number; budgetMs?: number }): Promise<RunSummary> {
  const started = Date.now();
  const summary: RunSummary = { claimed: 0, succeeded: 0, retried: 0, dead: 0, reclaimed: 0 };
  summary.reclaimed = await withSystem((tx) => reclaimStale(tx));
  const limit = opts.limit ?? 25;
  while (summary.claimed < limit && Date.now() - started < (opts.budgetMs ?? 50_000)) {
    const jobs = await withSystem((tx) => claimJobs(tx, opts.workerId, 1));
    const job = jobs[0];
    if (!job) break;
    summary.claimed++;
    await execute(job, summary);
  }
  return summary;
}

async function execute(job: JobRow, summary: RunSummary) {
  const handler = HANDLERS[job.kind];
  try {
    if (!handler) throw Object.assign(new Error(`no handler for ${job.kind}`), { retryable: false });
    const result = await withTimeout(handler(job), job.timeout_seconds);
    await withSystem((tx) => completeJob(tx, job.id, result));
    summary.succeeded++;
    log("info", "job.succeeded", { id: job.id, kind: job.kind });
  } catch (e) {
    const retryable = (e as { retryable?: boolean }).retryable !== false;
    const outcome = await withSystem((tx) => failJob(tx, job, (e as Error).message, retryable));
    if (outcome === "dead") summary.dead++;
    else summary.retried++;
    log(outcome === "dead" ? "error" : "warn", "job.failed", { id: job.id, kind: job.kind, attempt: job.attempts, outcome, error: (e as Error).message });
  }
}
