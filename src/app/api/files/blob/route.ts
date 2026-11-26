import { NextResponse } from "next/server";
import { verifyPayload } from "@/lib/crypto";
import { storage } from "@/lib/storage";
import { env } from "@/lib/env";

/** Local storage driver only: serves a signed, short-lived download as an attachment. */
export async function GET(req: Request) {
  if (env().STORAGE_PROVIDER !== "local") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const p = verifyPayload<{ path: string; name: string; type: string }>(new URL(req.url).searchParams.get("token") ?? undefined, "download");
  if (!p) return NextResponse.json({ error: "Link expired" }, { status: 403 });
  const bytes = await storage().get(p.path);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${p.name.replace(/[^\w.\- ]/g, "_")}"`,
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
