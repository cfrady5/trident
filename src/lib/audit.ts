import type { Tx } from "./db";

export interface AuditInput {
  action: string; // e.g. "application.submitted"
  entityType: string;
  entityId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown>;
  actorUserId?: string | null;
  actorType?: "user" | "system" | "job";
}

/**
 * Append an audit event inside the caller's transaction so the audit record
 * commits or rolls back with the change it describes.
 */
export async function audit(tx: Tx, a: AuditInput): Promise<void> {
  await tx`
    insert into public.audit_events (actor_user_id, actor_type, action, entity_type, entity_id, organization_id, metadata)
    values (${a.actorUserId ?? null}, ${a.actorType ?? (a.actorUserId ? "user" : "system")}, ${a.action},
            ${a.entityType}, ${a.entityId ?? null}, ${a.organizationId ?? null}, ${tx.json((a.metadata ?? {}) as never)})`;
}
