import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PageTitle, Table, Td, Th, dt } from "@/components/command/ui";
import { Pill } from "@/components/ui/primitives";

export const metadata = { title: "Assessments" };

export default async function AssessmentsPage() {
  const user = await requireStaff();
  const { rows, fw } = await withUser(user.id, async (tx) => ({
    rows: await tx<{ id: string; company_name: string | null; respondent_email: string | null; overall_score: string | null; completeness: string | null; review_state: string; mode: string; completed_at: Date | null }[]>`
      select id, company_name, respondent_email, overall_score, completeness, review_state, mode, completed_at from public.assessments order by created_at desc limit 300`,
    fw: await tx<{ key: string; version: number; status: string; name: string; categories: { name: string; weight: number }[] }[]>`select key, version, status, name, categories from public.assessment_frameworks order by version desc`,
  }));
  return (
    <>
      <PageTitle title="Assessments" subtitle="Commercial Readiness Index results. Self-assessments stay preliminary until a strategist reviews them (Phase 2)." />
      <div className="mb-6 border border-line p-4 text-[13px]">{fw.map((f) => <p key={f.version}><span className="font-medium">{f.name} v{f.version}</span> · <span className="text-gold">{f.status}</span> · {f.categories.map((c) => `${c.name} ${Math.round(c.weight * 100)}%`).join(" · ")}</p>)}</div>
      {rows.length === 0 ? <p className="border border-dashed border-line p-8 text-center text-caption text-ivory-70">No assessments yet.</p> : (
        <Table>
          <thead><tr><Th>Completed</Th><Th>Company</Th><Th>Respondent</Th><Th>Score</Th><Th>Completeness</Th><Th>Review</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><Td className="text-ivory-70">{dt(r.completed_at)}</Td><Td className="font-medium">{r.company_name}</Td><Td className="text-ivory-70">{r.respondent_email}</Td>
              <Td className="font-mono">{r.overall_score ?? "—"}</Td><Td className="font-mono">{r.completeness ? `${Math.round(Number(r.completeness) * 100)}%` : "—"}</Td>
              <Td><Pill tone={r.review_state === "human_reviewed" ? "ok" : "neutral"}>{r.review_state.replace("_", " ")}</Pill></Td></tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
