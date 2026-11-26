"use client";

import { useActionState } from "react";
import { requestLogin } from "@/app/actions/public";
import { Button } from "../ui/button";
import { Field, Input, describedBy } from "../ui/form";
import { Notice } from "../ui/primitives";

export function LoginForm({ next, withName, cta = "Email me a sign-in link" }: { next: string; withName?: boolean; cta?: string }) {
  const [state, action, pending] = useActionState(requestLogin, null);
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <Notice tone="success" title="Check your email">
          We sent a secure sign-in link to <strong className="text-ivory">{state.data.email}</strong>. It works once and expires in 15 minutes.
        </Notice>
        {state.data.devLink && (
          <div className="border border-dashed border-gold/50 p-4 text-caption">
            <p className="label text-gold">Development mode</p>
            <p className="mt-1 text-ivory-70">Email is captured in the dev outbox, not sent.</p>
            <a href={state.data.devLink} className="mt-2 inline-block text-gold-light underline" data-testid="dev-magic-link">Open sign-in link</a>
          </div>
        )}
      </div>
    );
  }
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && !fe.email && <Notice tone="error" title={state.message} />}
      {withName && <Field id="fullName" label="Your name" required><Input id="fullName" name="fullName" autoComplete="name" required /></Field>}
      <Field id="email" label="Business email" required error={fe.email} help={withName ? "We send a secure link instead of a password. Your progress saves to this email." : undefined}>
        <Input id="email" name="email" type="email" autoComplete="email" required invalid={!!fe.email} aria-describedby={describedBy("email", withName, fe.email)} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "Sending…" : cta}</Button>
    </form>
  );
}
