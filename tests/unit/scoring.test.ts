import { describe, expect, it } from "vitest";
import { band, recommendedServiceSlugs, scoreAssessment } from "@/lib/index/scoring";
import { frameworkCategories, frameworkCriteria } from "@/content/readiness-framework";

const cats = frameworkCategories;
const crit = frameworkCriteria.map((c) => ({ ...c, services: c.services }));
const best = Object.fromEntries(crit.map((c) => [c.key, c.options.filter((o) => o.score !== null).sort((a, b) => b.score! - a.score!)[0]!.value]));
const worst = Object.fromEntries(crit.map((c) => [c.key, c.options.filter((o) => o.score !== null).sort((a, b) => a.score! - b.score!)[0]!.value]));

describe("Commercial Readiness Index scoring", () => {
  it("framework category weights sum to 100%", () => {
    expect(cats.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 10);
    for (const c of cats) expect(crit.some((q) => q.category === c.key)).toBe(true);
  });

  it("is deterministic", () => {
    expect(scoreAssessment(cats, crit, best)).toEqual(scoreAssessment(cats, crit, best));
  });

  it("scores all-best answers 100 and all-worst 0", () => {
    expect(scoreAssessment(cats, crit, best).overall).toBe(100);
    expect(scoreAssessment(cats, crit, worst).overall).toBeLessThan(5); // lowest options score 0-10
    expect(scoreAssessment(cats, crit, best).completeness).toBe(1);
  });

  it("excludes 'Not sure' instead of scoring it as zero", () => {
    const answers = { ...best, target_buyer_defined: "not_sure" };
    const r = scoreAssessment(cats, crit, answers);
    expect(r.overall).toBe(100);
    expect(r.missing.map((m) => m.key)).toContain("target_buyer_defined");
    expect(r.completeness).toBeLessThan(1);
  });

  it("reports categories with no answers as insufficient, not zero", () => {
    const answers = Object.fromEntries(Object.entries(best).filter(([k]) => crit.find((c) => c.key === k)!.category !== "brand_identity"));
    const r = scoreAssessment(cats, crit, answers);
    expect(r.categories.find((c) => c.key === "brand_identity")!.score).toBeNull();
    expect(r.overall).toBe(100);
  });

  it("weights categories by their configured weights", () => {
    // Market positioning (20%) all best = 100; brand identity (15%) all worst = (0 + 10) / 2 = 5
    // overall = (0.2*100 + 0.15*5) / 0.35 = 59.3
    const answers: Record<string, string> = {};
    for (const c of crit) if (c.category === "market_positioning") answers[c.key] = best[c.key]!;
    for (const c of crit) if (c.category === "brand_identity") answers[c.key] = worst[c.key]!;
    expect(scoreAssessment(cats, crit, answers).overall).toBeCloseTo(59.3, 1);
  });

  it("ignores answers that are not valid options", () => {
    const r = scoreAssessment(cats, crit, { target_buyer_defined: "hacked" });
    expect(r.criteria.find((c) => c.key === "target_buyer_defined")!.missing).toBe(true);
  });

  it("caps priorities and recommendations, independent of price", () => {
    const r = scoreAssessment(cats, crit, worst);
    expect(r.priorities.length).toBeLessThanOrEqual(5);
    expect(recommendedServiceSlugs(r).length).toBeLessThanOrEqual(4);
    expect(recommendedServiceSlugs(scoreAssessment(cats, crit, best))).toEqual([]);
  });

  it("bands scores", () => {
    expect([band(10), band(40), band(70), band(90)]).toEqual(["foundational", "developing", "established", "advanced"]);
  });

  it("never reports confidence above medium for self-reported answers", () => {
    expect(scoreAssessment(cats, crit, best).confidence).toBe("medium");
  });
});
