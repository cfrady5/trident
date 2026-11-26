import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { APPLICATION_STATUS } from "@/lib/status";
import { requireUser } from "@/lib/auth";
import { loadApplication, EDITABLE_STATUSES } from "@/lib/application/service";
import { ApplicationWizard } from "@/components/apply/wizard";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Application", robots: { index: false } };

export default async function ApplicationPage({ params }: PageProps<"/apply/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(`/apply/${id}`);
  const data = await loadApplication(user.id, id);
  if (!data) notFound(); // RLS: other tenants' applications are invisible, so this is a 404, not a 403
  if (!EDITABLE_STATUSES.includes(data.app.status as never)) {
    const s = APPLICATION_STATUS[data.app.status]!;
    return (
      <div className="mx-auto max-w-2xl py-16">
        <p className="label text-gold">Application {s.label.toLowerCase()}</p>
        <h1 className="mt-4 font-display text-[2.5rem] font-bold leading-tight">{data.app.status === "submitted" ? "Thank you. Your application is with the Trident team." : s.label}</h1>
        <p className="mt-4 text-ivory-70">{s.client}</p>
        {data.app.status === "submitted" && (
          <ol className="mt-8 space-y-3 text-ivory-70">
            <li><span className="mr-3 font-mono text-gold">01</span>We confirm receipt by email.</li>
            <li><span className="mr-3 font-mono text-gold">02</span>A strategist reviews your answers and public information about your company.</li>
            <li><span className="mr-3 font-mono text-gold">03</span>We contact you to schedule a discovery call.</li>
          </ol>
        )}
        <Link href={`/portal/applications/${id}`} className="mt-10 inline-block text-gold-light">View your application and its status →</Link>
      </div>
    );
  }
  return (
    <ApplicationWizard
      applicationId={id} email={user.email} initialAnswers={data.answers} initialUnconfirmed={data.unconfirmed}
      initialFiles={data.files.map((f) => ({ ...f, created_at: f.created_at }))} initialStage={data.app.current_stage}
      completedStages={data.app.completed_stages} services={data.services} status={data.app.status} maxUploadMb={env().MAX_UPLOAD_MB}
      requestNote={data.app.status === "needs_information" ? [...data.history].reverse().find((h) => h.to_status === "needs_information")?.note : null}
    />
  );
}
