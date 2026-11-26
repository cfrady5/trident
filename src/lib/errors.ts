/** Structured, user-safe errors. Messages are shown to users; details are logged only. */
export type ErrorCode = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "conflict" | "rate_limited" | "unavailable" | "internal";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string> };

export function fail(code: ErrorCode, message: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, code, message, fieldErrors };
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Convert any thrown error into an ActionResult without leaking internals. */
export function toActionError(e: unknown): ActionResult<never> {
  if (e instanceof AppError) return fail(e.code, e.message);
  const code = (e as { code?: string })?.code;
  if (code === "42501") return fail("forbidden", "You don't have permission to do that.");
  if (code === "23505") return fail("conflict", "That record already exists.");
  log("error", "unhandled_action_error", { error: e instanceof Error ? e.message : String(e) });
  return fail("internal", "Something went wrong. Please try again.");
}

/** Minimal structured logger (JSON lines; picked up by Vercel log drains). */
export function log(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (process.env.APP_ENV !== "test") console.log(line);
}
