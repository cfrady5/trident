"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  addActivityAction, coiReviewAction, completeTaskAction, deleteFilterAction, grantRoleAction, retryJobAction, reviewFactAction,
  reviewFileAction, reviewRunAction, revokeRoleAction, saveFilterAction, setApplicationStatusAction, updateDataRequestAction,
  updateInquiryAction, updateOpportunityAction, updatePackageAction, updateServiceAction, verifyCredentialAction,
} from "@/app/actions/command";
import type { ActionResult } from "@/lib/errors";
import { STAGE_LABEL } from "@/lib/status";
import { Button } from "../ui/button";
import { Input, Select, Textarea } from "../ui/form";
import { cn } from "../ui/cn";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>, after?: () => void) => start(async () => {
    setError(null);
    const r = await fn();
    if (!r.ok) setError(r.message);
    else { after?.(); router.refresh(); }
  });
  return { pending, error, run };
}

const Err = ({ e }: { e: string | null }) => (e ? <p role="alert" className="mt-1 text-[12px] text-danger">{e}</p> : null);
const small = "h-8 rounded-[2px] border border-ivory/20 bg-black px-2 text-[13px] text-ivory focus:border-gold-light focus:outline-none";

export function CompleteTaskButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return <button type="button" disabled={pending} onClick={() => run(() => completeTaskAction(id))} className="shrink-0 text-[12px] text-gold-light hover:text-gold disabled:opacity-50">Done</button>;
}

export function ApplicationStatusControl({ id, status }: { id: string; status: string }) {
  const [next, setNext] = useState("under_review");
  const [note, setNote] = useState("");
  const { pending, error, run } = useRun();
  return (
    <div className="space-y-2">
      <Select value={next} onChange={(e) => setNext(e.target.value)} aria-label="New status">
        <option value="under_review">Under review</option>
        <option value="needs_information">Request information</option>
        <option value="accepted">Accept</option>
        <option value="declined">Decline</option>
      </Select>
      <Textarea className="min-h-20 text-[13px]" placeholder={next === "needs_information" ? "What do you need? (sent to the applicant)" : "Internal note (decision reason)"} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      <Button size="sm" disabled={pending || next === status} onClick={() => run(() => setApplicationStatusAction(id, next, note), () => setNote(""))}>{pending ? "Saving…" : "Update status"}</Button>
      <Err e={error} />
    </div>
  );
}

export function FileReviewControls({ id, status }: { id: string; status: string }) {
  const { pending, error, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px]">
      <a href={`/api/files/${id}/download`} className="text-ivory-70 hover:text-ivory" title="Quarantined: open only in an isolated viewer">Download</a>
      {status !== "released" && <button type="button" disabled={pending} className="text-success hover:underline" onClick={() => run(() => reviewFileAction(id, "release", ""))}>Release</button>}
      {status !== "held_for_review" && <button type="button" disabled={pending} className="text-gold hover:underline" onClick={() => run(() => reviewFileAction(id, "hold", ""))}>Hold</button>}
      <button type="button" disabled={pending} className="text-danger hover:underline" onClick={() => { if (confirm("Delete this file permanently?")) run(() => reviewFileAction(id, "delete", "Deleted by reviewer")); }}>Delete</button>
      <Err e={error} />
    </div>
  );
}

const COI_ITEMS: [string, string][] = [
  ["no_employer_program_relationship", "The company is not in a program the reviewer's employer runs or supports"],
  ["no_confidential_information_used", "No confidential or non-public employer information was used to identify or assess them"],
  ["no_employer_resources_used", "No employer resources, contacts or databases were used"],
  ["not_a_current_employer_counterparty", "The company is not a current counterparty of the reviewer's employer"],
];

export function CoiReviewForm({ opportunityId, status }: { opportunityId: string; status: string }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const { pending, error, run } = useRun();
  return (
    <div className="space-y-2 text-[13px]">
      <p className="text-ivory-70">Status: <span className={status === "cleared" ? "text-success" : status === "blocked" ? "text-danger" : "text-gold"}>{status}</span></p>
      {COI_ITEMS.map(([k, label]) => (
        <label key={k} className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 accent-[#E6A73B]" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />{label}</label>
      ))}
      <Textarea className="min-h-16 text-[13px]" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Review notes" />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => coiReviewAction(opportunityId, "cleared", checks, notes))}>Clear</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => coiReviewAction(opportunityId, "blocked", checks, notes))}>Block</Button>
      </div>
      <Err e={error} />
    </div>
  );
}

export function StageSelect({ id, stage }: { id: string; stage: string }) {
  const { pending, error, run } = useRun();
  const [lost, setLost] = useState("");
  const [next, setNext] = useState(stage);
  return (
    <div>
      <div className="flex gap-2">
        <select className={small} value={next} disabled={pending} aria-label="Stage" onChange={(e) => { setNext(e.target.value); if (e.target.value !== "closed_lost") run(() => updateOpportunityAction(id, { stage: e.target.value })); }}>
          {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {next === "closed_lost" && stage !== "closed_lost" && (
        <div className="mt-2 flex gap-2"><input className={cn(small, "flex-1")} placeholder="Why was it lost?" value={lost} onChange={(e) => setLost(e.target.value)} /><Button size="sm" disabled={pending} onClick={() => run(() => updateOpportunityAction(id, { stage: "closed_lost", lost_reason: lost }))}>Close</Button></div>
      )}
      <Err e={error} />
    </div>
  );
}

export function OpportunityEditor({ opp, staff }: { opp: { id: string; owner_user_id: string | null; estimated_contract_value_cents: number | null; estimated_mrr_cents: number | null; probability: number | null; next_action: string | null; next_action_due: string | null; qualification: Record<string, number> }; staff: { id: string; email: string }[] }) {
  const { pending, error, run } = useRun();
  const [f, setF] = useState({
    owner: opp.owner_user_id ?? "", ecv: opp.estimated_contract_value_cents != null ? String(opp.estimated_contract_value_cents / 100) : "",
    mrr: opp.estimated_mrr_cents != null ? String(opp.estimated_mrr_cents / 100) : "", prob: opp.probability != null ? String(opp.probability) : "",
    next: opp.next_action ?? "", due: opp.next_action_due ?? "",
    budget: String(opp.qualification.budget ?? 0), urgency: String(opp.qualification.urgency ?? 0), fit: String(opp.qualification.fit ?? 0), authority: String(opp.qualification.authority ?? 0),
  });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const total = ["budget", "urgency", "fit", "authority"].reduce((s, k) => s + Number(f[k as keyof typeof f] || 0), 0);
  return (
    <div className="grid gap-3 text-[13px] sm:grid-cols-2">
      <label>Owner<select className={cn(small, "mt-1 w-full")} value={f.owner} onChange={set("owner")}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}</select></label>
      <label>Probability %<input className={cn(small, "mt-1 w-full")} type="number" min={0} max={100} value={f.prob} onChange={set("prob")} /></label>
      <label>Est. contract value ($)<input className={cn(small, "mt-1 w-full")} type="number" min={0} value={f.ecv} onChange={set("ecv")} /></label>
      <label>Est. MRR ($)<input className={cn(small, "mt-1 w-full")} type="number" min={0} value={f.mrr} onChange={set("mrr")} /></label>
      <label className="sm:col-span-2">Next action<input className={cn(small, "mt-1 w-full")} value={f.next} onChange={set("next")} /></label>
      <label>Due<input className={cn(small, "mt-1 w-full")} type="date" value={f.due} onChange={set("due")} /></label>
      <fieldset className="sm:col-span-2">
        <legend className="text-ivory-70">Sales qualification (0–25 each) · <span className="font-mono text-gold">{total}/100</span></legend>
        <div className="mt-1 grid grid-cols-4 gap-2">{(["budget", "urgency", "fit", "authority"] as const).map((k) => <label key={k} className="capitalize">{k}<input className={cn(small, "mt-1 w-full")} type="number" min={0} max={25} value={f[k]} onChange={set(k)} /></label>)}</div>
        <p className="mt-1 text-[12px] text-ivory-50">Separate from commercial readiness: a company can need Trident without being ready to buy.</p>
      </fieldset>
      <div className="sm:col-span-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => updateOpportunityAction(opp.id, {
          owner_user_id: f.owner || null, estimated_contract_value_cents: num(f.ecv) == null ? null : Math.round(num(f.ecv)! * 100),
          estimated_mrr_cents: num(f.mrr) == null ? null : Math.round(num(f.mrr)! * 100), probability: num(f.prob), next_action: f.next || null, next_action_due: f.due || null,
          qualification: { budget: Number(f.budget), urgency: Number(f.urgency), fit: Number(f.fit), authority: Number(f.authority) },
        }))}>{pending ? "Saving…" : "Save"}</Button>
        <Err e={error} />
      </div>
    </div>
  );
}

export function ActivityForm({ companyId, opportunityId }: { companyId: string; opportunityId?: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(0);
  const [state, action, pending] = useActionState(async (p: unknown, fd: FormData) => { const r = await addActivityAction(p, fd); if (r.ok) { setSaved((n) => n + 1); router.refresh(); } return r; }, null);
  const [kind, setKind] = useState("note");
  return (
    <form action={action} key={saved} className="space-y-2 text-[13px]">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="opportunityId" value={opportunityId ?? ""} />
      <div className="flex gap-2">
        <select name="kind" className={small} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">{["note", "task", "call", "meeting", "email"].map((k) => <option key={k} value={k}>{k}</option>)}</select>
        {kind === "task" && <input name="dueOn" type="date" className={small} aria-label="Due date" />}
      </div>
      <Textarea name="body" className="min-h-16 text-[13px]" placeholder={kind === "task" ? "Task" : "Note"} required aria-label="Text" />
      <Button size="sm" type="submit" disabled={pending}>Add</Button>
      {state && !state.ok && <Err e={state.message} />}
    </form>
  );
}

export function CredentialVerify({ id, hasSource }: { id: string; hasSource: boolean }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex flex-wrap gap-2 text-[12px]">
      <button type="button" disabled={pending || !hasSource} title={hasSource ? "" : "Needs a source to verify"} className="text-success hover:underline disabled:text-ivory-50 disabled:no-underline" onClick={() => run(() => verifyCredentialAction(id, "verified", "Checked against source"))}>Verify</button>
      <button type="button" disabled={pending} className="text-gold hover:underline" onClick={() => run(() => verifyCredentialAction(id, "disputed", "Source does not match claim"))}>Dispute</button>
      <button type="button" disabled={pending} className="text-danger hover:underline" onClick={() => run(() => verifyCredentialAction(id, "rejected", "Rejected by reviewer"))}>Reject</button>
      <Err e={error} />
    </span>
  );
}

export function FactReview({ id }: { id: string }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex gap-2 text-[12px]">
      <button type="button" disabled={pending} className="text-success hover:underline" onClick={() => run(() => reviewFactAction(id, "approved"))}>Approve</button>
      <button type="button" disabled={pending} className="text-danger hover:underline" onClick={() => run(() => reviewFactAction(id, "rejected"))}>Reject</button>
      <Err e={error} />
    </span>
  );
}

export function RunReview({ id }: { id: string }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex gap-3 text-[12px]">
      <button type="button" disabled={pending} className="text-success hover:underline" onClick={() => run(() => reviewRunAction(id, "approved"))}>Mark reviewed</button>
      <button type="button" disabled={pending} className="text-danger hover:underline" onClick={() => run(() => reviewRunAction(id, "rejected"))}>Reject findings</button>
      <Err e={error} />
    </span>
  );
}

export function ServiceRowEditor({ s }: { s: { id: string; starting_price_cents: number; price_status: "proposed" | "approved"; turnaround_weeks_min: number | null; turnaround_weeks_max: number | null; turnaround_confirmed: boolean; included_revisions: number; is_published: boolean; is_featured: boolean } }) {
  const { pending, error, run } = useRun();
  const [f, setF] = useState({ price: String(s.starting_price_cents / 100), status: s.price_status, min: String(s.turnaround_weeks_min ?? ""), max: String(s.turnaround_weeks_max ?? ""), conf: s.turnaround_confirmed, rev: String(s.included_revisions), pub: s.is_published, feat: s.is_featured });
  const dirty = Number(f.price) * 100 !== s.starting_price_cents || f.status !== s.price_status || f.min !== String(s.turnaround_weeks_min ?? "") || f.max !== String(s.turnaround_weeks_max ?? "") || f.conf !== s.turnaround_confirmed || f.rev !== String(s.included_revisions) || f.pub !== s.is_published || f.feat !== s.is_featured;
  return (
    <>
      <td className="border-b border-line px-2 py-2"><input aria-label="Starting price" className={cn(small, "w-24")} type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></td>
      <td className="border-b border-line px-2 py-2"><select aria-label="Price status" className={small} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as "proposed" | "approved" })}><option value="proposed">proposed</option><option value="approved">approved</option></select></td>
      <td className="border-b border-line px-2 py-2 whitespace-nowrap"><input aria-label="Min weeks" className={cn(small, "w-12")} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />–<input aria-label="Max weeks" className={cn(small, "w-12")} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /> <label className="ml-1 text-[12px]"><input type="checkbox" checked={f.conf} onChange={(e) => setF({ ...f, conf: e.target.checked })} className="accent-[#E6A73B]" /> confirmed</label></td>
      <td className="border-b border-line px-2 py-2"><input aria-label="Revisions" className={cn(small, "w-12")} type="number" min={0} max={10} value={f.rev} onChange={(e) => setF({ ...f, rev: e.target.value })} /></td>
      <td className="border-b border-line px-2 py-2 text-[12px]"><label className="block"><input type="checkbox" checked={f.pub} onChange={(e) => setF({ ...f, pub: e.target.checked })} className="accent-[#E6A73B]" /> published</label><label className="block"><input type="checkbox" checked={f.feat} onChange={(e) => setF({ ...f, feat: e.target.checked })} className="accent-[#E6A73B]" /> featured</label></td>
      <td className="border-b border-line px-2 py-2">
        <Button size="sm" disabled={!dirty || pending} onClick={() => run(() => updateServiceAction(s.id, { starting_price_cents: Math.round(Number(f.price) * 100), price_status: f.status, turnaround_weeks_min: f.min ? Number(f.min) : null, turnaround_weeks_max: f.max ? Number(f.max) : null, turnaround_confirmed: f.conf, included_revisions: Number(f.rev), is_published: f.pub, is_featured: f.feat }))}>Save</Button>
        <Err e={error} />
      </td>
    </>
  );
}

export function PackageRowEditor({ p }: { p: { id: string; monthly_price_cents: number; price_status: "proposed" | "approved"; min_term_months: number; revision_limit: number; production_hours_capacity: string | null; is_published: boolean } }) {
  const { pending, error, run } = useRun();
  const [f, setF] = useState({ price: String(p.monthly_price_cents / 100), status: p.price_status, term: String(p.min_term_months), rev: String(p.revision_limit), hours: p.production_hours_capacity ?? "", pub: p.is_published });
  return (
    <>
      <td className="border-b border-line px-2 py-2"><input aria-label="Monthly price" className={cn(small, "w-24")} type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></td>
      <td className="border-b border-line px-2 py-2"><select aria-label="Price status" className={small} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as "proposed" | "approved" })}><option value="proposed">proposed</option><option value="approved">approved</option></select></td>
      <td className="border-b border-line px-2 py-2"><input aria-label="Minimum term" className={cn(small, "w-14")} type="number" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} /></td>
      <td className="border-b border-line px-2 py-2"><input aria-label="Revision limit" className={cn(small, "w-12")} type="number" value={f.rev} onChange={(e) => setF({ ...f, rev: e.target.value })} /></td>
      <td className="border-b border-line px-2 py-2"><input aria-label="Capacity hours" className={cn(small, "w-16")} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></td>
      <td className="border-b border-line px-2 py-2 text-[12px]"><label><input type="checkbox" checked={f.pub} onChange={(e) => setF({ ...f, pub: e.target.checked })} className="accent-[#E6A73B]" /> published</label></td>
      <td className="border-b border-line px-2 py-2"><Button size="sm" disabled={pending} onClick={() => run(() => updatePackageAction(p.id, { monthly_price_cents: Math.round(Number(f.price) * 100), price_status: f.status, min_term_months: Number(f.term), revision_limit: Number(f.rev), production_hours_capacity: f.hours === "" ? null : Number(f.hours), is_published: f.pub }))}>Save</Button><Err e={error} /></td>
    </>
  );
}

export function InquiryStatus({ id, status }: { id: string; status: string }) {
  const { pending, error, run } = useRun();
  return (
    <>
      <select aria-label="Inquiry status" className={small} value={status} disabled={pending} onChange={(e) => run(() => updateInquiryAction(id, e.target.value as "new"))}>
        {["new", "in_progress", "converted", "closed", "spam"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
      <Err e={error} />
    </>
  );
}

export function RetryJobButton({ id }: { id: string }) {
  const { pending, error, run } = useRun();
  return <><button type="button" disabled={pending} className="text-[12px] text-gold-light hover:underline" onClick={() => run(() => retryJobAction(id))}>Retry</button><Err e={error} /></>;
}

export function GrantRoleForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (p: unknown, fd: FormData) => { const r = await grantRoleAction(p, fd); if (r.ok) router.refresh(); return r; }, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-[13px]">
      <label>Email<Input name="email" type="email" required className="mt-1 h-9 w-64" /></label>
      <label>Role<Select name="role" className="mt-1 h-9 w-52">{["administrator", "business_development", "strategist", "creative_producer", "reviewer", "finance"].map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}</Select></label>
      <Button size="sm" type="submit" disabled={pending}>Grant</Button>
      {state && !state.ok && <Err e={state.message} />}
      {state?.ok && <p className="text-[12px] text-success">Role granted.</p>}
    </form>
  );
}

export function RevokeRoleButton({ id }: { id: string }) {
  const { pending, error, run } = useRun();
  return <><button type="button" disabled={pending} className="text-[12px] text-danger hover:underline" onClick={() => { if (confirm("Remove this person's staff access?")) run(() => revokeRoleAction(id)); }}>Remove</button><Err e={error} /></>;
}

export function DataRequestControls({ id }: { id: string }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex gap-2 text-[12px]">
      <button type="button" disabled={pending} className="text-gold-light hover:underline" onClick={() => run(() => updateDataRequestAction(id, "in_progress"))}>Start</button>
      <button type="button" disabled={pending} className="text-success hover:underline" onClick={() => run(() => updateDataRequestAction(id, "completed"))}>Complete</button>
      <button type="button" disabled={pending} className="text-danger hover:underline" onClick={() => run(() => updateDataRequestAction(id, "rejected"))}>Reject</button>
      <Err e={error} />
    </span>
  );
}

export function SaveViewButton({ scope, filters }: { scope: "opportunities" | "applications"; filters: Record<string, string> }) {
  const { pending, error, run } = useRun();
  return (
    <>
      <button type="button" disabled={pending} className="text-[12px] text-gold-light hover:underline" onClick={() => { const name = prompt("Name this view"); if (name) run(() => saveFilterAction(scope, name, filters)); }}>Save view</button>
      <Err e={error} />
    </>
  );
}

export function DeleteViewButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return <button type="button" disabled={pending} aria-label="Delete view" className="text-ivory-50 hover:text-danger" onClick={() => run(() => deleteFilterAction(id))}>×</button>;
}
