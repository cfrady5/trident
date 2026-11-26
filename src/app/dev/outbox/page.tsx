import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { withSystem } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev outbox", robots: { index: false } };

/** Development only: shows captured emails (including sign-in links). 404 in production. */
export default async function OutboxPage() {
  const e = env();
  if (e.APP_ENV === "production" || e.EMAIL_PROVIDER !== "dev_outbox") notFound();
  const rows = await withSystem((tx) => tx<{ id: string; to_email: string; subject: string; text_body: string; tag: string | null; created_at: Date }[]>`
    select id, to_email, subject, text_body, tag, created_at from app_private.dev_outbox order by created_at desc limit 50`);
  return (
    <main className="mx-auto max-w-[900px] px-5 py-10">
      <p className="label text-gold">Development outbox · emails are captured, never sent</p>
      <h1 className="mt-3 font-display text-[2rem] font-bold">Outbox</h1>
      {rows.length === 0 && <p className="mt-6 text-ivory-70">No emails yet.</p>}
      <ul className="mt-6 space-y-4">{rows.map((r) => (
        <li key={r.id} className="border border-line p-4" data-testid="outbox-item">
          <p className="text-caption text-ivory-70">{r.created_at.toLocaleString()} · to <span data-testid="outbox-to">{r.to_email}</span> · {r.tag}</p>
          <p className="mt-1 font-semibold">{r.subject}</p>
          <pre className="mt-3 whitespace-pre-wrap break-all font-sans text-caption text-ivory-70">{r.text_body}</pre>
        </li>
      ))}</ul>
    </main>
  );
}
