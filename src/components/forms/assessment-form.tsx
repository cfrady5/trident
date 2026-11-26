"use client";

import { useActionState, useMemo, useState } from "react";
import { submitAssessment } from "@/app/actions/public";
import type { ActiveFramework } from "@/lib/index/service";
import { Button } from "../ui/button";
import { Checkbox, Field, Input } from "../ui/form";
import { Notice } from "../ui/primitives";
import { cn } from "../ui/cn";

export function AssessmentForm({ framework, defaults }: { framework: Pick<ActiveFramework, "categories" | "criteria">; defaults: { name?: string; email?: string } }) {
  const [state, action, pending] = useActionState(submitAssessment, null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answered = Object.keys(answers).length;
  const total = framework.criteria.length;
  const byCategory = useMemo(() => framework.categories.map((c) => ({ ...c, criteria: framework.criteria.filter((q) => q.category === c.key) })), [framework]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={action} className="grid gap-12 lg:grid-cols-12">
      <div className="space-y-14 lg:col-span-8">
        {byCategory.map((cat, ci) => (
          <fieldset key={cat.key} className="border-t border-line pt-8">
            <legend className="sr-only">{cat.name}</legend>
            <p className="label text-gold">{String(ci + 1).padStart(2, "0")} · {cat.name} · {Math.round(cat.weight * 100)}%</p>
            <p className="mt-2 text-caption text-ivory-70">{cat.description}</p>
            <div className="mt-8 space-y-10">
              {cat.criteria.map((q) => (
                <fieldset key={q.key}>
                  <legend className="font-display text-h3 font-medium">{q.prompt}</legend>
                  {q.help && <p className="mt-1 text-caption text-ivory-70">{q.help}</p>}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {q.options.map((o) => (
                      <label key={o.value} className={cn("flex cursor-pointer items-start gap-3 border px-3.5 py-3 text-caption transition-colors", answers[q.key] === o.value ? "border-gold-light bg-gold/10" : "border-ivory/15 hover:border-ivory/40", o.score === null && "text-ivory-70")}>
                        <input type="radio" name={`q_${q.key}`} value={o.value} className="mt-0.5 accent-[#E6A73B]" checked={answers[q.key] === o.value} onChange={() => setAnswers((a) => ({ ...a, [q.key]: o.value }))} />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <aside className="lg:col-span-4">
        <div className="space-y-5 border border-line bg-carbon p-6 lg:sticky lg:top-24">
          <div>
            <p className="label text-ivory-70">Progress</p>
            <p className="mt-1 font-display text-h2 font-bold">{answered} of {total} answered</p>
            <div className="mt-3 h-1 bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} aria-label="Questions answered">
              <div className="gradient-gold h-1 transition-[width]" style={{ width: `${(answered / total) * 100}%` }} />
            </div>
          </div>
          {state && !state.ok && <Notice tone="error" title={state.message} />}
          <Field id="respondentName" label="Your name" required error={fe.respondentName}><Input id="respondentName" name="respondentName" defaultValue={defaults.name} autoComplete="name" invalid={!!fe.respondentName} /></Field>
          <Field id="respondentEmail" label="Business email" required error={fe.respondentEmail}><Input id="respondentEmail" name="respondentEmail" type="email" defaultValue={defaults.email} autoComplete="email" invalid={!!fe.respondentEmail} /></Field>
          <Field id="companyName" label="Company" required error={fe.companyName}><Input id="companyName" name="companyName" autoComplete="organization" invalid={!!fe.companyName} /></Field>
          <Field id="companyWebsite" label="Website"><Input id="companyWebsite" name="companyWebsite" inputMode="url" placeholder="https://" /></Field>
          <Checkbox id="consent" name="consent" label="Save my answers and email me a private link to my results." />
          {fe.consent && <p className="text-caption text-danger">{fe.consent}</p>}
          <Button type="submit" disabled={pending || answered < Math.ceil(total / 2)} className="w-full">{pending ? "Scoring…" : "See my results"}</Button>
          {answered < Math.ceil(total / 2) && <p className="text-caption text-ivory-50">Answer at least {Math.ceil(total / 2)} questions to get a result.</p>}
        </div>
      </aside>
    </form>
  );
}
