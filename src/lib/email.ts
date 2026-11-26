/**
 * Transactional email. EMAIL_PROVIDER=dev_outbox captures messages in
 * app_private.dev_outbox (viewable at /dev/outbox) and never sends them.
 * Templates follow the brand guide: Arial in email, Bronze links on white,
 * no exclamation marks, no emoji.
 */
import { env } from "./env";
import { withSystem } from "./db";
import { log } from "./errors";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<{ delivered: boolean; provider: string }> {
  const e = env();
  if (e.EMAIL_PROVIDER === "dev_outbox") {
    await withSystem((tx) => tx`
      insert into app_private.dev_outbox (to_email, subject, html, text_body, tag)
      values (${msg.to}, ${msg.subject}, ${msg.html}, ${msg.text}, ${msg.tag ?? null})`);
    log("info", "email.captured_in_dev_outbox", { to: msg.to, subject: msg.subject });
    return { delivered: false, provider: "dev_outbox" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: e.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, tags: msg.tag ? [{ name: "type", value: msg.tag }] : undefined }),
  });
  if (!res.ok) {
    const body = await res.text();
    log("error", "email.send_failed", { status: res.status, body: body.slice(0, 500) });
    throw new Error(`Email provider returned ${res.status}`);
  }
  return { delivered: true, provider: "resend" };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Minimal branded layout: White utility ground (email), Black text, Bronze links. */
export function layout(opts: { heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footnote?: string }): { html: string; text: string } {
  const ps = opts.paragraphs.map((p) => `<p style="margin:0 0 16px;font:16px/1.6 Arial,sans-serif;color:#000">${esc(p)}</p>`).join("");
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#000;color:#F7F3EA;font:600 15px Arial,sans-serif;padding:12px 20px;text-decoration:none">${esc(opts.cta.label)}</a></p><p style="margin:0 0 16px;font:13px/1.5 Arial,sans-serif;color:#555">Or paste this link into your browser:<br><a href="${esc(opts.cta.url)}" style="color:#996304;word-break:break-all">${esc(opts.cta.url)}</a></p>`
    : "";
  const foot = `<p style="margin:32px 0 0;font:12px/1.5 Arial,sans-serif;color:#555">${esc(opts.footnote ?? "Trident · Technology commercialization & creative agency")}<br>Trident is an independent company. It is not affiliated with, endorsed by or acting on behalf of any government agency or program.</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#fff"><div style="max-width:560px;margin:0 auto;padding:32px 24px"><p style="margin:0 0 24px;font:600 12px Arial,sans-serif;letter-spacing:.12em;color:#000">TRIDENT</p><h1 style="margin:0 0 16px;font:700 22px/1.25 Arial,sans-serif;color:#000">${esc(opts.heading)}</h1>${ps}${cta}${foot}</div></body></html>`;
  const text = [opts.heading, "", ...opts.paragraphs, ...(opts.cta ? ["", `${opts.cta.label}: ${opts.cta.url}`] : []), "", "Trident is an independent company. It is not affiliated with, endorsed by or acting on behalf of any government agency or program."].join("\n");
  return { html, text };
}

export function staffRecipients(): string[] {
  return env().STAFF_NOTIFICATION_EMAILS.split(",").map((s) => s.trim()).filter(Boolean);
}
