import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadApplication } from "@/lib/application/service";
import { APPLICATION_STATUS } from "@/lib/status";
import { STAGES, displayValue, isVisible, questionsForStage } from "@/lib/application/questions";
import { Eyebrow, Pill } from "@/components/ui/primitives";

export default async function PortalApplicationPage({ params }: PageProps<"/portal/applications/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(`/portal/applications/${id}`);
  const data = await loadApplication(user.id, id);
  if (!data) notFound();
  const s = APPLICATION_STATUS[data.app.status]!;
  const services = data.services.map((x) => ({ value: x.slug, label: x.name }));
  return (
    <div className="mx-auto max-w-[1000px]">
      <Link href="/portal" className="text-caption text-ivory-70 hover:text-ivory">← Overview</Link>
      <Eyebrow className="mt-6">Application</Eyebrow>
      <h1 className="mt-3 font-display text-[2.25rem] font-bold">{String(data.answers.company_name ?? "Your company")}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Pill tone={s.tone}>{s.label}</Pill><span className="text-caption text-ivory-70">{s.client}</span></div>
      {data.app.status === "needs_information" && <Link href={`/apply/${id}`} className="mt-4 inline-block text-gold-light">Update your application →</Link>}

      <section className="mt-10" aria-labelledby="timeline">
        <h2 id="timeline" className="font-display text-h2 font-bold">Status history</h2>
        <ol className="mt-4 border-l border-line pl-5">
          {data.history.map((h, i) => (
            <li key={i} className="relative pb-5 text-caption">
              <span className="absolute -left-[25px] top-1 h-2 w-2 rotate-45 border border-gold bg-black" aria-hidden />
              <span className="font-medium">{APPLICATION_STATUS[h.to_status]?.label ?? h.to_status}</span>
              <span className="ml-2 text-ivory-50">{h.created_at.toLocaleString()}</span>
              {h.note && <span className="block text-ivory-70">{h.note}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="answers">
        <h2 id="answers" className="font-display text-h2 font-bold">What you submitted</h2>
        {STAGES.slice(0, 6).map((st) => (
          <details key={st.number} className="mt-3 border-b border-line pb-3">
            <summary className="cursor-pointer py-2 font-medium"><span className="mr-3 font-mono text-caption text-gold">{String(st.number).padStart(2, "0")}</span>{st.title}</summary>
            <dl className="divide-y divide-line">
              {questionsForStage(st.number).filter((q) => isVisible(q, data.answers)).map((q) => (
                <div key={q.key} className="grid gap-1 py-2 text-caption sm:grid-cols-3"><dt className="text-ivory-70">{q.label}</dt><dd className="whitespace-pre-line sm:col-span-2">{displayValue(q.key === "services_of_interest" ? { ...q, options: services } : q, data.answers[q.key])}</dd></div>
              ))}
            </dl>
          </details>
        ))}
        {data.files.length > 0 && (
          <div className="mt-6"><p className="label text-ivory-70">Files</p>
            <ul className="mt-2 text-caption">{data.files.map((f) => <li key={f.id} className="flex justify-between border-b border-line py-2"><a href={`/api/files/${f.id}/download`} className="text-gold-light">{f.original_name}</a><span className="text-ivory-50">{f.quarantine_status === "released" ? "Accepted" : "Awaiting review"}</span></li>)}</ul>
          </div>
        )}
      </section>
    </div>
  );
}
