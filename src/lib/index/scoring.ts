/**
 * Commercial Readiness Index scoring. Pure and deterministic: the same
 * framework version and answers always produce the same result.
 *
 *  criterion score   = option score (0-100), or null when "Not sure"/missing
 *  category score    = weighted mean of answered criteria (criterion weights)
 *  overall score     = Σ(category weight × category score) / Σ(weights of
 *                      categories with any answered criteria)
 *  completeness      = answered criterion weight / total weight (0-1)
 *
 * Missing information is excluded and reported, never scored as zero.
 * Recommendations come only from the lowest-scoring answered criteria; the
 * number of recommendations does not depend on budget or contract value.
 */

export interface ScoringCategory {
  key: string;
  name: string;
  weight: number;
}

export interface ScoringCriterion {
  key: string;
  category: string;
  prompt: string;
  weight: number;
  options: { value: string; label: string; score: number | null }[];
  improvement: string;
  services: string[];
}

export interface CriterionResult {
  key: string;
  category: string;
  prompt: string;
  answer: string | null;
  answerLabel: string | null;
  score: number | null;
  missing: boolean;
  recommendation: string | null;
  services: string[];
}

export interface CategoryResult {
  key: string;
  name: string;
  weight: number;
  score: number | null;
  answered: number;
  total: number;
  band: Band | null;
}

export type Band = "foundational" | "developing" | "established" | "advanced";

export interface ScoreResult {
  overall: number | null;
  band: Band | null;
  completeness: number;
  categories: CategoryResult[];
  criteria: CriterionResult[];
  priorities: CriterionResult[];
  missing: CriterionResult[];
  confidence: "low" | "medium" | "high";
}

export function band(score: number): Band {
  if (score < 35) return "foundational";
  if (score < 60) return "developing";
  if (score < 80) return "established";
  return "advanced";
}

export const BAND_LABELS: Record<Band, string> = {
  foundational: "Foundational",
  developing: "Developing",
  established: "Established",
  advanced: "Advanced",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreAssessment(categories: ScoringCategory[], criteria: ScoringCriterion[], answers: Record<string, string | undefined>): ScoreResult {
  const results: CriterionResult[] = criteria.map((c) => {
    const answer = answers[c.key] ?? null;
    const option = answer ? c.options.find((o) => o.value === answer) : undefined;
    const score = option ? option.score : null;
    return {
      key: c.key,
      category: c.category,
      prompt: c.prompt,
      answer: option ? answer : null,
      answerLabel: option?.label ?? null,
      score,
      missing: score === null,
      recommendation: score !== null && score < 80 ? c.improvement : null,
      services: score !== null && score < 80 ? c.services : [],
    };
  });

  const cats: CategoryResult[] = categories.map((cat) => {
    const inCat = criteria.filter((c) => c.category === cat.key);
    let wsum = 0;
    let acc = 0;
    let answered = 0;
    for (const c of inCat) {
      const r = results.find((x) => x.key === c.key)!;
      if (r.score === null) continue;
      wsum += c.weight;
      acc += c.weight * r.score;
      answered++;
    }
    const score = wsum > 0 ? round1(acc / wsum) : null;
    return { key: cat.key, name: cat.name, weight: cat.weight, score, answered, total: inCat.length, band: score === null ? null : band(score) };
  });

  const scored = cats.filter((c) => c.score !== null);
  const wTotal = scored.reduce((s, c) => s + c.weight, 0);
  const overall = wTotal > 0 ? round1(scored.reduce((s, c) => s + c.weight * (c.score as number), 0) / wTotal) : null;

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const answeredWeight = criteria.filter((c) => results.find((r) => r.key === c.key)!.score !== null).reduce((s, c) => s + c.weight, 0);
  const completeness = totalWeight > 0 ? Math.round((answeredWeight / totalWeight) * 10000) / 10000 : 0;

  // Priorities: lowest weighted gaps first; ties broken by framework order (stable).
  const catWeight = Object.fromEntries(categories.map((c) => [c.key, c.weight]));
  const critWeight = Object.fromEntries(criteria.map((c) => [c.key, c.weight]));
  const priorities = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.score !== null && r.score < 80)
    .sort((a, b) => {
      const ga = (100 - (a.r.score as number)) * (catWeight[a.r.category] ?? 0) * (critWeight[a.r.key] ?? 1);
      const gb = (100 - (b.r.score as number)) * (catWeight[b.r.category] ?? 0) * (critWeight[b.r.key] ?? 1);
      return gb - ga || a.i - b.i;
    })
    .slice(0, 5)
    .map(({ r }) => r);

  return {
    overall,
    band: overall === null ? null : band(overall),
    completeness,
    categories: cats,
    criteria: results,
    priorities,
    missing: results.filter((r) => r.missing),
    confidence: completeness >= 0.85 ? "medium" : "low", // self-reported answers never exceed medium until reviewed
  };
}

/** Distinct services from priorities, in priority order. Capped, not padded. */
export function recommendedServiceSlugs(result: ScoreResult, max = 4): string[] {
  const out: string[] = [];
  for (const p of result.priorities) for (const s of p.services) if (!out.includes(s) && out.length < max) out.push(s);
  return out;
}
