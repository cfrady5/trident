import { describe, expect, it } from "vitest";
import { QUESTIONS, allErrors, isVisible, questionByKey, stageErrors, validateAnswer, normalizeAnswer } from "@/lib/application/questions";
import { completeAnswers } from "../support/fixtures";

describe("application definition", () => {
  it("has unique keys and seven stages of content", () => {
    const keys = QUESTIONS.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(QUESTIONS.map((q) => q.stage))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("accepts a complete application", () => {
    expect(allErrors(completeAnswers())).toEqual({});
  });

  it("reports required fields per stage", () => {
    const e = stageErrors(1, {});
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["company_name", "website", "industry"]));
  });

  it("applies conditional questions", () => {
    const agency = questionByKey("sbir_agency")!;
    expect(isVisible(agency, { sbir_status: "none" })).toBe(false);
    expect(isVisible(agency, { sbir_status: "awarded" })).toBe(true);
  });

  it("validates option values, URLs and credential entries", () => {
    expect(validateAnswer(questionByKey("industry")!, "not-an-industry")).toMatch(/Choose/);
    expect(validateAnswer(questionByKey("website")!, "javascript:alert(1)")).toMatch(/valid web address/);
    expect(validateAnswer(questionByKey("website")!, "acme.com")).toBeNull();
    expect(validateAnswer(questionByKey("credentials")!, [{ type: "contract", title: "" }])).toMatch(/title/);
    expect(validateAnswer(questionByKey("credentials")!, [{ type: "contract", title: "X", sourceUrl: "ftp://x" }])).toMatch(/source/);
    expect(validateAnswer(questionByKey("services_of_interest")!, ["position-sprint"], ["position-sprint"])).toBeNull();
    expect(validateAnswer(questionByKey("services_of_interest")!, ["made-up"], ["position-sprint"])).toMatch(/Choose/);
  });

  it("normalizes URLs without a scheme", () => {
    expect(normalizeAnswer(questionByKey("website")!, " acme.com ")).toBe("https://acme.com");
  });
});
