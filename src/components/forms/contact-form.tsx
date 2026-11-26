"use client";

import { useActionState } from "react";
import { submitInquiry } from "@/app/actions/public";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Textarea, describedBy } from "../ui/form";
import { Notice } from "../ui/primitives";

export function ContactForm({ kind, services, serviceNames }: { kind: "contact" | "proposal_request"; services: string[]; serviceNames: string[] }) {
  const [state, action, pending] = useActionState(submitInquiry, null);
  if (state?.ok) {
    return (
      <Notice tone="success" title="Thank you. Your request is with the Trident team.">
        We reply within two business days. To move faster, you can start a company application or take the readiness assessment.
      </Notice>
    );
  }
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="services" value={services.join(",")} />
      <div aria-hidden className="hidden"><label>Leave blank<input name="company_url_confirm" tabIndex={-1} autoComplete="off" /></label></div>
      {state && !state.ok && <Notice tone="error" title={state.message} />}
      {serviceNames.length > 0 && (
        <div className="border border-line p-4">
          <p className="label text-ivory-70">Services in this request</p>
          <ul className="mt-2 text-caption">{serviceNames.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="fullName" label="Name" required error={fe.fullName}><Input id="fullName" name="fullName" autoComplete="name" required invalid={!!fe.fullName} aria-describedby={describedBy("fullName", null, fe.fullName)} /></Field>
        <Field id="email" label="Business email" required error={fe.email}><Input id="email" name="email" type="email" autoComplete="email" required invalid={!!fe.email} aria-describedby={describedBy("email", null, fe.email)} /></Field>
        <Field id="companyName" label="Company"><Input id="companyName" name="companyName" autoComplete="organization" /></Field>
        <Field id="website" label="Website"><Input id="website" name="website" inputMode="url" placeholder="https://" /></Field>
      </div>
      <Field id="message" label={kind === "proposal_request" ? "Anything we should know?" : "How can we help?"} error={fe.message}><Textarea id="message" name="message" maxLength={5000} /></Field>
      <Checkbox id="consent" name="consent" label="Trident may contact me about this request. I won't include classified, controlled unclassified or export-controlled information." />
      {fe.consent && <p className="text-caption text-danger">{fe.consent}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : kind === "proposal_request" ? "Request a proposal" : "Send message"}</Button>
    </form>
  );
}
