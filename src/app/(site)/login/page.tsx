import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { LoginForm } from "@/components/forms/login-form";
import { currentUser, safeRedirect } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = { invalid_link: "That sign-in link is invalid or has expired. Request a new one." };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeRedirect(typeof sp.next === "string" ? sp.next : null);
  const user = await currentUser().catch(() => null);
  if (user) redirect(next);
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : null;
  return (
    <Container className="max-w-[560px] py-20 md:py-28">
      <Eyebrow>Sign in</Eyebrow>
      <h1 className="mt-5 font-display text-[2.5rem] font-bold leading-tight">Welcome back.</h1>
      <p className="mt-4 text-ivory-70">No password needed. We&apos;ll email you a secure, single-use link.</p>
      {error && <p role="alert" className="mt-6 border-l-2 border-danger pl-4 text-caption text-danger">{error}</p>}
      <div className="mt-10"><LoginForm next={next} /></div>
    </Container>
  );
}
