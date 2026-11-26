"use client";

import { useActionState } from "react";
import { requestDataAction } from "@/app/actions/account";
import { Button } from "../ui/button";

export function DataRequestButton({ kind, label, disabled }: { kind: "export" | "deletion"; label: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(requestDataAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending || disabled || state?.ok}>{state?.ok ? "Requested" : label}</Button>
      {state && !state.ok && <p className="mt-2 text-caption text-danger">{state.message}</p>}
    </form>
  );
}
