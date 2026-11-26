import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { withSystem, withUser, isPermissionError } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";
import { safeFilename, screenUpload, validateUpload } from "@/lib/storage/screening";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { log } from "@/lib/errors";

const CATEGORIES = ["logo", "brand_guidelines", "pitch_deck", "capability_statement", "marketing", "other"];

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload files." }, { status: 401 });
  if (!(await rateLimit(`upload:${user.id}`, 30, 3600))) return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > (env().MAX_UPLOAD_MB + 1) * 1024 * 1024) return NextResponse.json({ error: `Files must be ${env().MAX_UPLOAD_MB} MB or smaller.` }, { status: 413 });

  const form = await req.formData();
  const applicationId = String(form.get("applicationId") ?? "");
  const category = String(form.get("category") ?? "other");
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(applicationId) || !(file instanceof File)) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: "Choose a file type." }, { status: 400 });
  const invalid = validateUpload(file.name, file.type, file.size);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Authorization: the application must be visible and editable by this user (RLS).
  const app = await withUser(user.id, (tx) => tx<{ organization_id: string; status: string }[]>`
    select organization_id, status from public.applications where id = ${applicationId}`);
  if (!app[0]) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (!["draft", "needs_information"].includes(app[0].status)) return NextResponse.json({ error: "This application can no longer be edited." }, { status: 409 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const screening = await screenUpload(bytes, file.type);
  const orgId = app[0].organization_id;
  const path = `orgs/${orgId}/applications/${applicationId}/${randomUUID()}-${safeFilename(file.name)}`;

  try {
    if (screening.quarantineStatus !== "deleted") await storage().put(path, bytes, file.type);
    const [row] = await withUser(user.id, (tx) => tx<{ id: string }[]>`
      insert into public.files (organization_id, application_id, uploaded_by, bucket, storage_path, original_name, content_type, size_bytes, sha256, category)
      values (${orgId}, ${applicationId}, ${user.id}, ${env().STORAGE_BUCKET}, ${path}, ${file.name.slice(0, 255)}, ${file.type}, ${file.size}, ${sha256(Buffer.from(bytes))}, ${category})
      returning id`);
    await withSystem(async (tx) => {
      await tx`update public.files set scan_status = ${screening.scanStatus}, quarantine_status = ${screening.quarantineStatus},
                 screening_notes = ${tx.json(screening.notes as never)}, deleted_at = ${screening.quarantineStatus === "deleted" ? new Date() : null}
               where id = ${row!.id}`;
      await audit(tx, { action: "file.uploaded", entityType: "file", entityId: row!.id, organizationId: orgId, actorUserId: user.id, actorType: "user", metadata: { scan: screening.scanStatus, quarantine: screening.quarantineStatus } });
      await emitEvent(tx, { name: "document.uploaded", idempotencyKey: `document.uploaded:${row!.id}`, producer: "upload_route", payload: { file_id: row!.id, organization_id: orgId }, actorUserId: user.id, organizationId: orgId, subjectType: "file", subjectId: row!.id });
    });
    if (screening.quarantineStatus === "deleted") {
      return NextResponse.json({ error: "This file failed malware screening and was rejected." }, { status: 422 });
    }
    return NextResponse.json({
      file: { id: row!.id, original_name: file.name, category, size_bytes: String(file.size), content_type: file.type, scan_status: screening.scanStatus, quarantine_status: screening.quarantineStatus, screening_notes: screening.notes, created_at: new Date().toISOString() },
    });
  } catch (e) {
    await storage().remove(path).catch(() => undefined);
    if (isPermissionError(e)) return NextResponse.json({ error: "You don't have permission to upload to this application." }, { status: 403 });
    log("error", "upload.failed", { error: (e as Error).message });
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
