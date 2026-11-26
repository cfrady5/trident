/**
 * Case study architecture. Intentionally empty: Trident publishes no case
 * study until a real engagement is complete, the client has approved the text
 * in writing, and every figure and credential has a source on file.
 * /case-studies/[slug] renders only entries with status "published".
 */
export interface CaseStudy {
  slug: string;
  status: "draft" | "client_review" | "published";
  clientName: string;
  clientApprovalRecordedOn: string | null; // ISO date of written approval
  pillar: "position" | "build" | "activate" | "program";
  headline: string;
  challenge: string;
  work: string[];
  outcomes: { claim: string; source: string; date: string }[];
}

export const caseStudies: CaseStudy[] = [];

export const publishedCaseStudies = () =>
  caseStudies.filter((c) => c.status === "published" && c.clientApprovalRecordedOn && c.outcomes.every((o) => o.source && o.date));
