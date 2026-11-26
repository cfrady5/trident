import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { withSystem, withUser } from "@/lib/db";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

/** Issues a 60-second signed URL after an RLS-checked read of the file record. */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]/download">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [f] = await withUser(user.id, (tx) => tx<{ storage_path: string; original_name: string; content_type: string; organization_id: string | null; quarantine_status: string; uploaded_by: string | null }[]>`
    select storage_path, original_name, content_type, organization_id, quarantine_status, uploaded_by from public.files where id = ${id} and deleted_at is null`);
  if (!f) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Quarantined files: only staff reviewers and the original uploader may retrieve them.
  if (f.quarantine_status !== "released" && !user.isStaff && f.uploaded_by !== user.id) return NextResponse.json({ error: "File is awaiting review." }, { status: 403 });
  await withSystem((tx) => audit(tx, { action: "file.downloaded", entityType: "file", entityId: id, organizationId: f.organization_id, actorUserId: user.id, actorType: "user" }));
  const url = await storage().signedUrl(f.storage_path, { ttlSeconds: 60, filename: f.original_name, contentType: f.content_type });
  return NextResponse.redirect(new URL(url, env().APP_URL), { status: 302, headers: { "Cache-Control": "no-store" } });
}
