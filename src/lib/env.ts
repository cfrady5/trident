/**
 * Validated server environment. Import only from server code.
 *
 * Integrations resolve to either a real provider or an explicit development
 * mode. Development modes are refused when APP_ENV=production, so a deploy can
 * never silently run on the local auth, local storage or the email outbox.
 */
import { z } from "zod";

const schema = z
  .object({
    APP_ENV: z.enum(["development", "test", "demo", "production"]).default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),

    AUTH_PROVIDER: z.enum(["supabase", "local"]).default("local"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    STORAGE_PROVIDER: z.enum(["supabase", "local"]).default("local"),
    STORAGE_BUCKET: z.string().default("trident-private"),
    LOCAL_STORAGE_DIR: z.string().default(".data/storage"),
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(25),
    MALWARE_SCAN_URL: z.string().url().optional(),

    EMAIL_PROVIDER: z.enum(["resend", "dev_outbox"]).default("dev_outbox"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Trident <no-reply@localhost>"),
    STAFF_NOTIFICATION_EMAILS: z.string().default(""),

    AI_PROVIDER: z.enum(["anthropic", "none"]).default("none"),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
    AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(50),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    CRON_SECRET: z.string().min(16).optional(),
    PLATFORM_OWNER_EMAILS: z.string().default(""),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
    const prod = env.APP_ENV === "production";
    const req = (cond: boolean, path: string, message: string) => {
      if (!cond) ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (prod) {
      req(env.AUTH_PROVIDER === "supabase", "AUTH_PROVIDER", "local auth is not allowed in production");
      req(env.STORAGE_PROVIDER === "supabase", "STORAGE_PROVIDER", "local storage is not allowed in production");
      req(env.EMAIL_PROVIDER === "resend", "EMAIL_PROVIDER", "the dev outbox is not allowed in production");
      req(!!env.CRON_SECRET, "CRON_SECRET", "required in production");
    }
    if (env.AUTH_PROVIDER === "supabase" || env.STORAGE_PROVIDER === "supabase") {
      req(!!env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL", "required for Supabase providers");
      req(!!env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY", "required for Supabase providers");
    }
    if (env.STORAGE_PROVIDER === "supabase") req(!!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY", "required for Supabase storage");
    if (env.EMAIL_PROVIDER === "resend") req(!!env.RESEND_API_KEY, "RESEND_API_KEY", "required for Resend");
    if (env.AI_PROVIDER === "anthropic") req(!!env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY", "required for Anthropic");
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isDevMode = () => env().APP_ENV !== "production";

/** Human-readable integration status for Trident Command. Never includes secrets. */
export function integrationStatus() {
  const e = env();
  return [
    { name: "Database", mode: "PostgreSQL", connected: true, note: e.DATABASE_URL.includes("127.0.0.1") || e.DATABASE_URL.includes("localhost") ? "Local development database" : "Remote database" },
    { name: "Authentication", mode: e.AUTH_PROVIDER, connected: e.AUTH_PROVIDER === "supabase", note: e.AUTH_PROVIDER === "local" ? "Development magic links (dev outbox). Not for production." : "Supabase Auth" },
    { name: "Storage", mode: e.STORAGE_PROVIDER, connected: e.STORAGE_PROVIDER === "supabase", note: e.STORAGE_PROVIDER === "local" ? `Local filesystem (${e.LOCAL_STORAGE_DIR})` : `Supabase bucket ${e.STORAGE_BUCKET}` },
    { name: "Malware scanning", mode: e.MALWARE_SCAN_URL ? "external" : "basic", connected: !!e.MALWARE_SCAN_URL, note: e.MALWARE_SCAN_URL ? "External scanner configured" : "Built-in checks only; files stay quarantined until a reviewer releases them" },
    { name: "Email", mode: e.EMAIL_PROVIDER, connected: e.EMAIL_PROVIDER === "resend", note: e.EMAIL_PROVIDER === "dev_outbox" ? "Captured in the dev outbox, never sent" : "Resend" },
    { name: "AI", mode: e.AI_PROVIDER, connected: e.AI_PROVIDER !== "none", note: e.AI_PROVIDER === "none" ? "Not configured. AI workflow steps are recorded as blocked, not simulated." : `${e.AI_PROVIDER}` },
    { name: "Payments", mode: e.STRIPE_SECRET_KEY ? "stripe" : "none", connected: false, note: "Phase 3. Integration boundary only." },
    { name: "Analytics", mode: e.NEXT_PUBLIC_POSTHOG_KEY ? "posthog" : "none", connected: !!e.NEXT_PUBLIC_POSTHOG_KEY, note: e.NEXT_PUBLIC_POSTHOG_KEY ? "PostHog, consent-gated" : "Not configured" },
  ];
}
