"use client";

import { useActionState } from "react";
import { startApplicationAction } from "@/app/actions/application";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/form";
import { Notice } from "../ui/primitives";

export function StartApplicationForm({ defaultName }: { defaultName?: string }) {
  const [state, action, pending] = useActionState(startApplicationAction, null);
  return (
    <form action={action} className="space-y-5">
      {state && !state.ok && <Notice tone="error" title={state.message} />}
      <Field id="contactName" label="Your name" required><Input id="contactName" name="contactName" defaultValue={defaultName} autoComplete="name" required /></Field>
      <Field id="companyName" label="Company name" required><Input id="companyName" name="companyName" autoComplete="organization" required minLength={2} maxLength={200} /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Starting…" : "Start application"}</Button>
    </form>
  );
}
