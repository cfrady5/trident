/**
 * Long-running job worker for self-hosted or local environments.
 *   npm run worker            loop forever, polling every 5s
 *   npm run worker -- --once  drain ready jobs once and exit
 * On Vercel, Cron calls /api/jobs/run instead (see vercel.json).
 */
import { hostname } from "node:os";
import { runJobs } from "../src/lib/jobs/runner.ts";
import { db } from "../src/lib/db.ts";

const once = process.argv.includes("--once");
const workerId = `${hostname()}:${process.pid}`;
let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

async function main() {
  do {
    const summary = await runJobs({ workerId, limit: 50, budgetMs: 55_000 });
    if (summary.claimed || summary.reclaimed) console.log(JSON.stringify({ event: "worker.batch", ...summary }));
    if (once) break;
    await new Promise((r) => setTimeout(r, 5000));
  } while (!stopping);
  await db().end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
