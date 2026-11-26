import { headers } from "next/headers";
import { withSystem } from "./db";
import { sha256 } from "./crypto";

/**
 * Fixed-window rate limiter backed by Postgres (works across serverless
 * instances without extra infrastructure). Returns true when allowed.
 */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await withSystem((tx) => tx<{ hits: number }[]>`
    insert into app_private.rate_limits (bucket, window_start, hits) values (${bucket}, ${windowStart}, 1)
    on conflict (bucket, window_start) do update set hits = app_private.rate_limits.hits + 1
    returning hits`);
  if (Math.random() < 0.01) {
    void withSystem((tx) => tx`delete from app_private.rate_limits where window_start < now() - interval '1 day'`);
  }
  return (rows[0]?.hits ?? 0) <= limit;
}

/** Hashed client identifier (we never store raw IPs for rate limiting). */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return sha256(ip).slice(0, 24);
}
