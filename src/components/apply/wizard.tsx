"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { autosaveAction, completeStageAction, deleteFileAction, importFromWebsiteAction, submitApplicationAction } from "@/app/actions/application";
import {
  CONSENTS, CREDENTIAL_TYPES, STAGES, displayValue, isVisible, questionsForStage, stageProgress,
  type Answers, type CredentialEntry, type Question,
} from "@/lib/application/questions";
import type { FileRecord } from "@/lib/application/service";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Select, Textarea, describedBy } from "../ui/form";
import { Notice, Pill } from "../ui/primitives";
import { cn } from "../ui/cn";

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "error"; message: string };

const FILE_CATEGORIES = [
  ["logo", "Logo files"], ["brand_guidelines", "Brand guidelines"], ["pitch_deck", "Pitch deck"],
  ["capability_statement", "Capability statement"], ["marketing", "Marketing material"], ["other", "Other"],
] as const;

export interface WizardProps {
  applicationId: string;
  email: string;
  initialAnswers: Answers;
  initialUnconfirmed: string[];
  initialFiles: FileRecord[];
  initialStage: number;
  completedStages: number[];
  services: { slug: string; name: string }[];
  status: string;
  requestNote?: string | null;
  maxUploadMb: number;
}

export function ApplicationWizard(props: WizardProps) {
  const [answers, setAnswers] = useState<Answers>(props.initialAnswers);
  const [unconfirmed, setUnconfirmed] = useState<string[]>(props.initialUnconfirmed);
  const [files, setFiles] = useState<FileRecord[]>(props.initialFiles);
  const [stage, setStage] = useState(props.initialStage);
  const [completed, setCompleted] = useState<number[]>(props.completedStages);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const pendingPatch = useRef<Answers>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const flush = useCallback(async (stageOverride?: number) => {
    if (timer.current) clearTimeout(timer.current);
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    if (Object.keys(patch).length === 0 && !stageOverride) return true;
    setSave({ kind: "saving" });
    const r = await autosaveAction(props.applicationId, patch, stageOverride);
    if (!r.ok) {
      pendingPatch.current = { ...patch, ...pendingPatch.current };
      setSave({ kind: "error", message: r.message });
      return false;
    }
    setErrors((e) => {
      const next = { ...e };
      for (const k of r.data.saved) delete next[k];
      return { ...next, ...r.data.errors };
    });
    setUnconfirmed((u) => u.filter((k) => !r.data.saved.includes(k)));
    setSave({ kind: "saved", at: r.data.at });
    return true;
  }, [props.applicationId]);

  const update = useCallback((key: string, value: unknown) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    pendingPatch.current[key] = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 900);
  }, [flush]);

  // Save before the tab closes.
  useEffect(() => {
    const onHide = () => { if (Object.keys(pendingPatch.current).length) void flush(); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  const goTo = useCallback(async (n: number) => {
    await flush(n);
    setStage(n);
    setErrors({});
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => headingRef.current?.focus());
  }, [flush]);

  const continueStage = () => startTransition(async () => {
    if (!(await flush())) return;
    const r = await completeStageAction(props.applicationId, stage);
    if (!r.ok) { setSave({ kind: "error", message: r.message }); return; }
    if (Object.keys(r.data.errors).length) {
      setErrors(r.data.errors);
      requestAnimationFrame(() => document.getElementById(Object.keys(r.data.errors)[0]!)?.focus());
      return;
    }
    setCompleted((c) => Array.from(new Set([...c, stage])));
    await goTo(stage + 1);
  });

  const submit = () => startTransition(async () => {
    setSubmitError(null);
    if (!(await flush())) return;
    const r = await submitApplicationAction(props.applicationId, consents);
    if (!r.ok) {
      setSubmitError(r.message);
      if (r.fieldErrors) setErrors(r.fieldErrors);
      return;
    }
    // No router.refresh(): the server page now redirects submitted applications
    // to the read-only view, which would replace this confirmation.
    setSubmitted(true);
    window.scrollTo({ top: 0 });
  });

  const progress = useMemo(() => stageProgress(answers), [answers]);
  const current = STAGES.find((s) => s.number === stage)!;
  const serviceOptions = props.services.map((s) => ({ value: s.slug, label: s.name }));

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <p className="label text-gold">Application submitted</p>
        <h1 className="mt-4 font-display text-[2.5rem] font-bold leading-tight">Thank you. Your application is with the Trident team.</h1>
        <ol className="mt-8 space-y-3 text-ivory-70">
          <li><span className="mr-3 font-mono text-gold">01</span>We confirm receipt by email.</li>
          <li><span className="mr-3 font-mono text-gold">02</span>A strategist reviews your answers and public information about your company.</li>
          <li><span className="mr-3 font-mono text-gold">03</span>We contact you to schedule a discovery call.</li>
        </ol>
        <Link href="/portal" className="mt-10 inline-block text-gold-light">Track status in your portal →</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <nav aria-label="Application stages" className="lg:col-span-3">
        <ol className="space-y-1 lg:sticky lg:top-24">
          {STAGES.map((s) => {
            const p = progress.find((x) => x.stage === s.number);
            const isDone = completed.includes(s.number);
            const reachable = s.number <= Math.max(...completed, 0) + 1 || isDone;
            return (
              <li key={s.number}>
                <button type="button" disabled={!reachable || pending} onClick={() => goTo(s.number)} aria-current={s.number === stage ? "step" : undefined}
                  className={cn("flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left text-caption transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    s.number === stage ? "border-gold bg-carbon text-ivory" : "border-line text-ivory-70 hover:text-ivory")}>
                  <span className="font-mono text-gold">{String(s.number).padStart(2, "0")}</span>
                  <span className="flex-1">{s.title}</span>
                  {isDone ? <span aria-label="complete" className="text-success">✓</span> : p && <span className="font-mono text-[11px] text-ivory-50">{p.answered}/{p.total}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="lg:col-span-9" aria-labelledby="stage-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-6">
          <div>
            <p className="label text-gold">Stage {stage} of 7</p>
            <h1 id="stage-heading" ref={headingRef} tabIndex={-1} className="mt-2 font-display text-[2rem] font-bold leading-tight focus:outline-none">{current.title}</h1>
            <p className="mt-2 text-ivory-70">{current.intro}</p>
          </div>
          <SaveIndicator state={save} />
        </div>

        {props.status === "needs_information" && (
          <Notice tone="warning" className="mt-6" title="The Trident team asked for more information">
            {props.requestNote && <span className="block text-ivory">&ldquo;{props.requestNote}&rdquo;</span>}
            Update your answers using the Edit links, then submit again.
          </Notice>
        )}

        {stage < 7 ? (
          <div className="mt-8 space-y-7">
            {stage === 1 && (
              <Field id="business_email" label="Business email" required help="Your sign-in email. To use a different address, sign in with it instead.">
                <Input id="business_email" value={props.email} readOnly disabled />
              </Field>
            )}
            {stage === 2 && <WebsiteImport applicationId={props.applicationId} website={answers.website as string | undefined} onImported={(imp) => { setAnswers((a) => ({ ...a, ...imp })); setUnconfirmed((u) => Array.from(new Set([...u, ...Object.keys(imp)]))); }} />}
            {questionsForStage(stage).filter((q) => isVisible(q, answers)).map((q) => (
              <QuestionField key={q.key} q={q.key === "services_of_interest" ? { ...q, options: serviceOptions } : q} value={answers[q.key]} error={errors[q.key]} unconfirmed={unconfirmed.includes(q.key)} onChange={(v) => update(q.key, v)} />
            ))}
            {stage === 3 && <Notice title="How we treat these claims">Everything here is recorded as self-reported until a Trident reviewer checks it against its source. We never publish a credential without a verified source and date.</Notice>}
            {stage === 5 && <FileUploads applicationId={props.applicationId} files={files} setFiles={setFiles} maxMb={props.maxUploadMb} />}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
              <Button type="button" onClick={continueStage} disabled={pending}>{pending ? "Checking…" : "Save and continue"}</Button>
              {stage > 1 && <Button type="button" variant="ghost" onClick={() => goTo(stage - 1)} disabled={pending}>Back</Button>}
              {Object.keys(errors).length > 0 && <p role="alert" className="text-caption text-danger">{Object.keys(errors).length} field(s) need attention.</p>}
            </div>
          </div>
        ) : (
          <Review answers={answers} files={files} unconfirmed={unconfirmed} errors={errors} services={serviceOptions} onEdit={goTo} consents={consents} setConsents={setConsents} submit={submit} pending={pending} error={submitError} />
        )}
      </section>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const text = state.kind === "saving" ? "Saving…" : state.kind === "saved" ? `Saved ${new Date(state.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : state.kind === "error" ? state.message : "Changes save automatically";
  return <p role="status" aria-live="polite" className={cn("text-caption", state.kind === "error" ? "text-danger" : "text-ivory-70")}>{text}</p>;
}

function QuestionField({ q, value, error, unconfirmed, onChange }: { q: Question; value: unknown; error?: string; unconfirmed: boolean; onChange: (v: unknown) => void }) {
  const id = q.key;
  const aria = describedBy(id, q.help, error);
  const help = (
    <>
      {q.help}
      {unconfirmed && <span className="mt-1 block text-gold">Imported from your website. Edit it, or confirm it as written.</span>}
    </>
  );
  return (
    <Field id={id} label={q.label} required={q.required} help={q.help || unconfirmed ? help : undefined} error={error}>
      {q.type === "textarea" ? (
        <Textarea id={id} value={(value as string) ?? ""} maxLength={q.maxLength} placeholder={q.placeholder} invalid={!!error} aria-describedby={aria} onChange={(e) => onChange(e.target.value)} />
      ) : q.type === "select" ? (
        <Select id={id} value={(value as string) ?? ""} invalid={!!error} aria-describedby={aria} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {q.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ) : q.type === "multiselect" ? (
        <div id={id} role="group" aria-describedby={aria} className="grid gap-2 sm:grid-cols-2">
          {q.options!.map((o) => {
            const list = Array.isArray(value) ? (value as string[]) : [];
            const on = list.includes(o.value);
            return (
              <label key={o.value} className={cn("flex cursor-pointer items-center gap-3 border px-3 py-2.5 text-caption", on ? "border-gold-light bg-gold/10" : "border-ivory/15 hover:border-ivory/40")}>
                <input type="checkbox" className="accent-[#E6A73B]" checked={on} onChange={() => onChange(on ? list.filter((v) => v !== o.value) : [...list, o.value])} />
                {o.label}
              </label>
            );
          })}
        </div>
      ) : q.type === "credentials" ? (
        <CredentialsEditor value={Array.isArray(value) ? (value as CredentialEntry[]) : []} onChange={onChange} />
      ) : (
        <Input id={id} type={q.type === "url" ? "url" : "text"} inputMode={q.type === "url" ? "url" : undefined} value={(value as string) ?? ""} maxLength={q.maxLength ?? 500} placeholder={q.placeholder} invalid={!!error} aria-describedby={aria} onChange={(e) => onChange(e.target.value)} />
      )}
      {unconfirmed && <button type="button" onClick={() => onChange(value)} className="self-start text-caption text-gold-light underline">Confirm as written</button>}
    </Field>
  );
}

function CredentialsEditor({ value, onChange }: { value: CredentialEntry[]; onChange: (v: CredentialEntry[]) => void }) {
  const set = (i: number, patch: Partial<CredentialEntry>) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-4">
      {value.map((c, i) => (
        <fieldset key={i} className="grid gap-3 border border-line p-4 sm:grid-cols-2">
          <legend className="label px-1 text-ivory-70">Claim {i + 1}</legend>
          <label className="text-caption">Type<Select className="mt-1" value={c.type} onChange={(e) => set(i, { type: e.target.value as CredentialEntry["type"] })}>{CREDENTIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></label>
          <label className="text-caption">Exact wording<Input className="mt-1" value={c.title} maxLength={200} placeholder="Selected as Awardable on …" onChange={(e) => set(i, { title: e.target.value })} /></label>
          <label className="text-caption">Agency or organization<Input className="mt-1" value={c.agency ?? ""} maxLength={200} onChange={(e) => set(i, { agency: e.target.value })} /></label>
          <label className="text-caption">Public identifier<Input className="mt-1" value={c.identifier ?? ""} maxLength={200} placeholder="Award or contract number, if public" onChange={(e) => set(i, { identifier: e.target.value })} /></label>
          <label className="text-caption">Date<Input className="mt-1" value={c.date ?? ""} placeholder="YYYY-MM" onChange={(e) => set(i, { date: e.target.value })} /></label>
          <label className="text-caption">Public source URL<Input className="mt-1" value={c.sourceUrl ?? ""} inputMode="url" placeholder="https://" onChange={(e) => set(i, { sourceUrl: e.target.value })} /></label>
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <Checkbox id={`cred-public-${i}`} checked={!!c.publiclyShareable} onChange={(e) => set(i, { publiclyShareable: e.target.checked })} label="This can be shared publicly" />
            <button type="button" className="text-caption text-ivory-70 hover:text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </fieldset>
      ))}
      {value.length < 25 && <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, { type: "sbir_award", title: "" }])}>Add a claim</Button>}
    </div>
  );
}

function WebsiteImport({ applicationId, website, onImported }: { applicationId: string; website?: string; onImported: (a: Record<string, string>) => void }) {
  const [msg, setMsg] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!website) return null;
  return (
    <div className="border border-line bg-carbon p-5">
      <p className="font-semibold">Save time: import from {website.replace(/^https?:\/\//, "")}</p>
      <p className="mt-1 text-caption text-ivory-70">We read your public homepage and suggest answers for empty fields. You confirm or edit every suggestion.</p>
      <Button type="button" size="sm" variant="secondary" className="mt-3" disabled={pending} onClick={() => start(async () => {
        const r = await importFromWebsiteAction(applicationId);
        if (!r.ok) setMsg({ tone: "error", text: r.message });
        else if (!Object.keys(r.data.imported).length) setMsg({ tone: "info", text: "Nothing new to import. Your fields are already filled, or the page had no usable description." });
        else { onImported(r.data.imported); setMsg({ tone: "success", text: `Suggested ${Object.keys(r.data.imported).length} answer(s). Review them below.` }); }
      })}>{pending ? "Reading website…" : "Import from website"}</Button>
      {msg && <p role="status" className={cn("mt-3 text-caption", msg.tone === "error" ? "text-danger" : "text-ivory-70")}>{msg.text}</p>}
    </div>
  );
}

function FileUploads({ applicationId, files, setFiles, maxMb }: { applicationId: string; files: FileRecord[]; setFiles: (f: FileRecord[] | ((x: FileRecord[]) => FileRecord[])) => void; maxMb: number }) {
  const [category, setCategory] = useState("logo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("category", category);
    fd.set("file", file);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Upload failed.");
      else setFiles((f) => [...f, body.file]);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="border-t border-line pt-7">
      <p className="font-semibold">Brand and marketing files</p>
      <p className="mt-1 text-caption text-ivory-70">Logos, guidelines, decks, capability statements. PDF, PNG, JPG, WEBP, SVG, PPTX, DOCX or TXT, up to {maxMb} MB each. Every file is screened and held for review by a person before it is used.</p>
      <Notice tone="warning" className="mt-4">Do not upload classified, controlled unclassified (CUI) or export-controlled material, or confidential third-party documents.</Notice>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-caption sm:w-56">File type<Select className="mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>{FILE_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></label>
        <label className={cn("inline-flex h-11 cursor-pointer items-center justify-center border border-ivory/30 px-5 font-semibold hover:border-ivory", busy && "pointer-events-none opacity-50")}>
          {busy ? "Uploading…" : "Choose file"}
          <input ref={inputRef} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.pptx,.docx,.txt,.md" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} data-testid="file-input" />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-caption text-danger">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-5 border-t border-line">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 text-caption">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{f.original_name}</span><span className="text-ivory-50">{FILE_CATEGORIES.find(([v]) => v === f.category)?.[1]} · {(Number(f.size_bytes) / 1024).toFixed(0)} KB</span></span>
              <Pill tone={f.quarantine_status === "held_for_review" ? "warn" : f.quarantine_status === "released" ? "ok" : "neutral"}>{f.quarantine_status === "held_for_review" ? "Held for review" : f.quarantine_status === "released" ? "Accepted" : "Awaiting review"}</Pill>
              <button type="button" className="text-ivory-70 hover:text-danger" onClick={async () => { const r = await deleteFileAction(f.id); if (r.ok) setFiles((x) => x.filter((y) => y.id !== f.id)); else setError(r.message); }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Review({ answers, files, unconfirmed, errors, services, onEdit, consents, setConsents, submit, pending, error }: {
  answers: Answers; files: FileRecord[]; unconfirmed: string[]; errors: Record<string, string>; services: { value: string; label: string }[]; onEdit: (n: number) => void;
  consents: Record<string, boolean>; setConsents: (c: Record<string, boolean>) => void; submit: () => void; pending: boolean; error: string | null;
}) {
  return (
    <div className="mt-8 space-y-10">
      {STAGES.slice(0, 6).map((s) => (
        <section key={s.number} aria-labelledby={`review-${s.number}`}>
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h2 id={`review-${s.number}`} className="font-display text-h2 font-bold"><span className="mr-3 font-mono text-caption text-gold">{String(s.number).padStart(2, "0")}</span>{s.title}</h2>
            <button type="button" className="text-caption text-gold-light" onClick={() => onEdit(s.number)}>Edit</button>
          </div>
          <dl className="divide-y divide-line">
            {questionsForStage(s.number).filter((q) => isVisible(q, answers)).map((q) => (
              <div key={q.key} className="grid gap-1 py-3 text-caption sm:grid-cols-3">
                <dt className="text-ivory-70">{q.label}{q.required && <span className="text-gold"> *</span>}</dt>
                <dd className={cn("sm:col-span-2 whitespace-pre-line", errors[q.key] && "text-danger")}>
                  {q.type === "credentials" && Array.isArray(answers[q.key]) ? (
                    <ul className="space-y-1">{(answers[q.key] as CredentialEntry[]).map((c, i) => <li key={i}>{c.title || "Untitled"}{c.date && ` · ${c.date}`} {c.sourceUrl ? <Pill tone="ok">source linked</Pill> : <Pill>self-reported</Pill>}</li>)}</ul>
                  ) : displayValue(q.key === "services_of_interest" ? { ...q, options: services } : q, answers[q.key])}
                  {unconfirmed.includes(q.key) && <span className="ml-2 text-gold">· needs confirmation</span>}
                  {errors[q.key] && <span className="block">{errors[q.key]}</span>}
                </dd>
              </div>
            ))}
            {s.number === 5 && <div className="grid gap-1 py-3 text-caption sm:grid-cols-3"><dt className="text-ivory-70">Files</dt><dd className="sm:col-span-2">{files.length ? files.map((f) => f.original_name).join(", ") : "—"}</dd></div>}
          </dl>
        </section>
      ))}
      <section className="border border-line bg-carbon p-6" aria-labelledby="consent-heading">
        <h2 id="consent-heading" className="font-display text-h2 font-bold">How we use this information</h2>
        <p className="mt-2 text-caption text-ivory-70">Your answers create your company profile. A Trident strategist reviews it with public information about your company to prepare an internal assessment and, if there&apos;s a fit, a proposal. Nothing you submit is published, and every claim stays marked as self-reported until it has been verified against a source.</p>
        <div className="mt-6 space-y-4">
          {CONSENTS.map((c) => <Checkbox key={c.key} id={`consent-${c.key}`} checked={!!consents[c.key]} onChange={(e) => setConsents({ ...consents, [c.key]: e.target.checked })} label={c.statement} />)}
        </div>
        {error && <Notice tone="error" className="mt-6" title={error} />}
        <Button type="button" className="mt-6" onClick={submit} disabled={pending || CONSENTS.some((c) => !consents[c.key])}>{pending ? "Submitting…" : "Submit application"}</Button>
      </section>
    </div>
  );
}
