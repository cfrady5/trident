/**
 * Passwordless authentication.
 *
 *   AUTH_PROVIDER=supabase  Supabase Auth magic links (production).
 *   AUTH_PROVIDER=local     Development only: single-use, hashed, 15-minute
 *                           tokens delivered to the dev outbox; session in an
 *                           HMAC-signed httpOnly cookie. Refused in production.
 *
 * Both providers resolve to an auth.users id, which is what RLS keys on.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "../env";
import { withSystem, withUser } from "../db";
import { randomToken, sha256, signPayload, verifyPayload } from "../crypto";
import { layout, sendEmail } from "../email";
import { audit } from "../audit";
import { AppError, log } from "../errors";
import { supabaseServer } from "./supabase";

export const SESSION_COOKIE = "trident_session";
const SESSION_TTL = 60 * 60 * 24 * 7;
const TOKEN_TTL_MINUTES = 15;

export type StaffRole =
  | "platform_owner" | "administrator" | "business_development" | "strategist"
  | "creative_producer" | "reviewer" | "finance";
export type ClientRole = "client_admin" | "client_contributor" | "client_viewer";

export interface Membership {
  organizationId: string;
  organizationName: string;
  organizationKind: "internal" | "client" | "partner";
  role: StaffRole | ClientRole;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  memberships: Membership[];
  staffRoles: StaffRole[];
  isStaff: boolean;
}

/** Only same-site relative paths are accepted as post-login redirects. */
export function safeRedirect(path: string | null | undefined, fallback = "/portal"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function requestMagicLink(input: { email: string; fullName?: string; redirectTo?: string }): Promise<{ devLink?: string }> {
  const email = emailSchema.parse(input.email);
  const redirectTo = safeRedirect(input.redirectTo);
  const e = env();

  if (e.AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${e.APP_URL}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        data: input.fullName ? { full_name: input.fullName } : undefined,
        shouldCreateUser: true,
      },
    });
    if (error) {
      log("warn", "auth.magic_link_failed", { message: error.message });
      throw new AppError("unavailable", "We couldn't send a sign-in link right now. Please try again shortly.");
    }
    return {};
  }

  // Local development provider.
  const token = randomToken();
  await withSystem((tx) => tx`
    insert into app_private.local_auth_tokens (token_hash, email, full_name, redirect_to, expires_at)
    values (${sha256(token)}, ${email}, ${input.fullName ?? null}, ${redirectTo}, now() + make_interval(mins => ${TOKEN_TTL_MINUTES}))`);
  const link = `${e.APP_URL}/auth/callback?token=${token}`;
  const { html, text } = layout({
    heading: "Your secure sign-in link",
    paragraphs: [
      "Use the link below to sign in to Trident. It works once and expires in 15 minutes.",
      "If you didn't request this, you can ignore this email.",
    ],
    cta: { label: "Sign in to Trident", url: link },
  });
  await sendEmail({ to: email, subject: "Your Trident sign-in link", html, text, tag: "magic_link" });
  return { devLink: e.APP_ENV === "production" ? undefined : link };
}

/** Completes a local-provider sign-in. Returns the redirect path. */
export async function completeLocalSignIn(token: string): Promise<string> {
  if (env().AUTH_PROVIDER !== "local") throw new AppError("forbidden", "Local sign-in is disabled.");
  const row = await withSystem(async (tx) => {
    const [t] = await tx<{ email: string; full_name: string | null; redirect_to: string }[]>`
      update app_private.local_auth_tokens set used_at = now()
      where token_hash = ${sha256(token)} and used_at is null and expires_at > now()
      returning email, full_name, redirect_to`;
    if (!t) return null;
    const [u] = await tx<{ id: string }[]>`
      insert into auth.users (email, raw_user_meta_data, email_confirmed_at, last_sign_in_at)
      values (${t.email}, ${tx.json({ full_name: t.full_name ?? "" })}, now(), now())
      on conflict (email) do update set last_sign_in_at = now()
      returning id`;
    return { userId: u!.id, email: t.email, fullName: t.full_name, redirectTo: t.redirect_to };
  });
  if (!row) throw new AppError("invalid", "This sign-in link is invalid or has expired. Request a new one.");
  await onSignedIn(row.userId, row.email, row.fullName);
  const store = await cookies();
  store.set(SESSION_COOKIE, signPayload({ sub: row.userId, email: row.email }, "session", SESSION_TTL), {
    httpOnly: true,
    secure: env().APP_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return row.redirectTo;
}

/** Completes a Supabase sign-in from the PKCE code. */
export async function completeSupabaseSignIn(code: string): Promise<void> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) throw new AppError("invalid", "This sign-in link is invalid or has expired. Request a new one.");
  await onSignedIn(data.user.id, data.user.email, (data.user.user_metadata?.full_name as string | undefined) ?? null);
}

/** Post sign-in bootstrap: profile, owner grant, audit. Idempotent. */
async function onSignedIn(userId: string, email: string, fullName: string | null) {
  const owners = env().PLATFORM_OWNER_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  await withSystem(async (tx) => {
    await tx`insert into public.profiles (id, email, full_name) values (${userId}, ${email.toLowerCase()}, ${fullName})
             on conflict (id) do update set full_name = coalesce(public.profiles.full_name, excluded.full_name)`;
    if (owners.includes(email.toLowerCase())) {
      await tx`insert into public.organization_memberships (organization_id, user_id, role)
               select id, ${userId}, 'platform_owner' from public.organizations where kind = 'internal'
               on conflict (organization_id, user_id) do nothing`;
    }
    await audit(tx, { action: "auth.signed_in", entityType: "profile", entityId: userId, actorUserId: userId, actorType: "user" });
  });
}

async function sessionUserId(): Promise<string | null> {
  const e = env();
  if (e.AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser(); // verifies the JWT with Supabase
    return data.user?.id ?? null;
  }
  const store = await cookies();
  const payload = verifyPayload<{ sub: string }>(store.get(SESSION_COOKIE)?.value, "session");
  return payload?.sub ?? null;
}

/** The signed-in user with memberships, memoized per request. Reads run under RLS. */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await sessionUserId();
  if (!userId) return null;
  return withUser(userId, async (tx) => {
    const [profile] = await tx<{ id: string; email: string; full_name: string | null }[]>`
      select id, email, full_name from public.profiles where id = ${userId}`;
    if (!profile) return null;
    const rows = await tx<{ organization_id: string; name: string; kind: Membership["organizationKind"]; role: Membership["role"] }[]>`
      select m.organization_id, o.name, o.kind, m.role
      from public.organization_memberships m join public.organizations o on o.id = m.organization_id
      where m.user_id = ${userId} and o.archived_at is null order by o.kind, o.name`;
    const memberships = rows.map((r) => ({ organizationId: r.organization_id, organizationName: r.name, organizationKind: r.kind, role: r.role }));
    const staffRoles = memberships.filter((m) => m.organizationKind === "internal").map((m) => m.role as StaffRole);
    return { id: profile.id, email: profile.email, fullName: profile.full_name, memberships, staffRoles, isStaff: staffRoles.length > 0 };
  });
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next ?? "/portal")}`);
  return user;
}

export function hasStaffRole(user: CurrentUser, ...roles: StaffRole[]): boolean {
  return user.staffRoles.some((r) => r === "platform_owner" || r === "administrator" || roles.includes(r));
}

/** For Command pages: requires any staff role (or one of `roles`). */
export async function requireStaff(...roles: StaffRole[]): Promise<CurrentUser> {
  const user = await requireUser("/command");
  if (!user.isStaff || (roles.length > 0 && !hasStaffRole(user, ...roles))) redirect("/forbidden");
  return user;
}

export async function signOut(): Promise<void> {
  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(SESSION_COOKIE);
}
