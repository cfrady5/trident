/**
 * Database access. Every query runs inside one of three explicit contexts:
 *
 *   withUser(userId, fn)  role `authenticated`, auth.uid() = userId. RLS enforced.
 *   withAnon(fn)          role `anon`. RLS enforced. Public catalog reads.
 *   withSystem(fn)        role `service_role`. Bypasses RLS. Only for trusted
 *                         server workflows (jobs, submission pipeline, auth
 *                         bootstrap). Callers must authorize before using it.
 *
 * The connection itself is privileged; the role is lowered per transaction so
 * Supabase RLS policies apply identically in production and local development.
 */
import postgres from "postgres";
import { env } from "./env";

export type Tx = postgres.TransactionSql<Record<string, unknown>>;
export type Sql = postgres.Sql<Record<string, unknown>>;

const globalForDb = globalThis as unknown as { __tridentSql?: Sql };

export function db(): Sql {
  if (!globalForDb.__tridentSql) {
    globalForDb.__tridentSql = postgres(env().DATABASE_URL, {
      max: process.env.VERCEL ? 3 : 10,
      prepare: false, // required for Supabase's transaction pooler
      idle_timeout: 20,
      onnotice: () => {},
      transform: { undefined: null },
    });
  }
  return globalForDb.__tridentSql;
}

async function inRole<T>(role: "authenticated" | "anon" | "service_role", claims: Record<string, unknown>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true), set_config('role', ${role}, true)`;
    return fn(tx as unknown as Tx);
  }) as Promise<T>;
}

export function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("withUser requires a user id");
  return inRole("authenticated", { sub: userId, role: "authenticated" }, fn);
}

export function withAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRole("anon", { role: "anon" }, fn);
}

export function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRole("service_role", { role: "service_role" }, fn);
}

/** True when an error is a Postgres permission / RLS violation. */
export function isPermissionError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === "42501";
}

export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = e as { code?: string; constraint_name?: string };
  return err?.code === "23505" && (!constraint || err.constraint_name === constraint);
}
