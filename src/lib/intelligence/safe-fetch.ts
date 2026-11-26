/**
 * Fetching of public, applicant-supplied URLs for permitted website analysis.
 *
 * Protections:
 *  - http/https only, default ports only, no credentials in URL
 *  - DNS resolved and private, loopback, link-local and metadata ranges refused (SSRF)
 *  - redirects followed manually (max 3), each hop re-validated
 *  - robots.txt honoured for our user agent
 *  - response size and time limits; HTML only
 * Retrieved content is untrusted data and is never executed or obeyed.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const USER_AGENT = "TridentResearchBot/0.1 (+public website analysis; respects robots.txt)";
const MAX_BYTES = 1_500_000;

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]!) : false;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p as [number, number, number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https URLs are allowed");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Non-standard ports are not allowed");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Private hosts are not allowed");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("Host resolves to a private address");
  return url;
}

async function boundedFetch(url: URL, accept: string): Promise<Response> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(current.toString());
    const res = await fetch(current, { redirect: "manual", headers: { "User-Agent": USER_AGENT, Accept: accept }, signal: AbortSignal.timeout(10_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Minimal robots.txt evaluation for `User-agent: *` and our agent. */
export function robotsAllows(robots: string, path: string): boolean {
  let applies = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]!.trim();
    const [k, ...rest] = line.split(":");
    const key = k?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") applies = value === "*" || /tridentresearchbot/i.test(value);
    else if (applies && key === "disallow" && value) disallow.push(value);
    else if (applies && key === "allow" && value) allow.push(value);
  }
  const longest = (list: string[]) => Math.max(-1, ...list.filter((p) => path.startsWith(p)).map((p) => p.length));
  return longest(allow) >= longest(disallow);
}

export interface FetchedPage {
  finalUrl: string;
  status: number;
  html: string;
  https: boolean;
}

export async function fetchPublicPage(raw: string): Promise<FetchedPage> {
  const url = await assertPublicUrl(raw);
  try {
    const robotsRes = await boundedFetch(new URL("/robots.txt", url), "text/plain");
    if (robotsRes.ok && !robotsAllows(await readCapped(robotsRes), url.pathname || "/")) {
      throw new Error("robots.txt disallows automated access to this page");
    }
  } catch (e) {
    if ((e as Error).message.startsWith("robots.txt")) throw e;
    // robots.txt unavailable: treat as allowed, per the robots exclusion standard.
  }
  const res = await boundedFetch(url, "text/html");
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) throw new Error(`Unexpected content type: ${type || "unknown"}`);
  return { finalUrl: res.url || url.toString(), status: res.status, html: await readCapped(res), https: url.protocol === "https:" };
}

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Deterministic, non-AI extraction of public page signals. */
export function analyzeHtml(html: string) {
  const meta = (name: string) =>
    html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"))?.[1] ?? null;
  const all = (tag: string) => [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => strip(m[1]!)).filter(Boolean).slice(0, 12);
  const body = strip(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " "));
  return {
    title: strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null,
    description: meta("description") ?? meta("og:description"),
    ogImage: meta("og:image"),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    h1: all("h1"),
    h2: all("h2"),
    wordCount: body ? body.split(" ").length : 0,
    linksToLinkedIn: /linkedin\.com\/company\//i.test(html),
    hasContactPath: /href=["'][^"']*(contact|mailto:)/i.test(html),
    textSample: body.slice(0, 6000),
  };
}
