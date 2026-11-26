import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runJobs } from "@/lib/jobs/runner";

export const maxDuration = 60;

/** Durable job execution endpoint for Vercel Cron (Authorization: Bearer CRON_SECRET). */
async function handle(req: Request) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runJobs({ workerId: `http:${crypto.randomUUID().slice(0, 8)}`, limit: 25, budgetMs: 50_000 });
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
