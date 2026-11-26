import { NextResponse } from "next/server";
import { loadAssessmentByToken } from "@/lib/index/service";

/** Structured JSON export of a self-assessment for its token holder. */
export async function GET(req: Request, ctx: RouteContext<"/api/assessments/[id]">) {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const data = await loadAssessmentByToken(id, token);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { assessment: a, framework } = data;
  return new NextResponse(JSON.stringify({
    id: a.id, company: a.company_name, completed_at: a.completed_at, review_state: a.review_state,
    framework: { key: framework.key, version: framework.version, methodology_note: framework.methodologyNote },
    result: a.computed,
  }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="readiness-${a.id.slice(0, 8)}.json"`, "Cache-Control": "no-store" } });
}
