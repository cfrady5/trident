"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { type ActionResult, fail, ok, toActionError } from "@/lib/errors";

export async function requestDataAction(_: unknown, form: FormData): Promise<ActionResult<{ kind: string }>> {
  try {
    const user = await requireUser("/portal/settings");
    const kind = String(form.get("kind"));
    if (kind !== "export" && kind !== "deletion") return fail("invalid", "Unknown request.");
    await withUser(user.id, async (tx) => {
      const open = await tx`select 1 from public.data_requests where user_id = ${user.id} and kind = ${kind} and status in ('requested', 'in_progress')`;
      if (open.length) return;
      await tx`insert into public.data_requests (user_id, kind) values (${user.id}, ${kind})`;
      await tx`insert into public.audit_events (actor_user_id, actor_type, action, entity_type, entity_id) values (${user.id}, 'user', ${`data_request.${kind}`}, 'profile', ${user.id})`;
    });
    revalidatePath("/portal/settings");
    return ok({ kind });
  } catch (e) {
    return toActionError(e);
  }
}
