import { describe, expect, it } from "vitest";
import { screenUpload, validateUpload, safeFilename } from "@/lib/storage/screening";
import { backoffSeconds } from "@/lib/jobs/queue";
import { EVENT_CATALOG } from "@/lib/events";
import { DEFAULT_SCENARIO, scenario } from "@/lib/command/metrics";
import { safeRedirect } from "@/lib/auth";
import { signPayload, verifyPayload } from "@/lib/crypto";

const enc = (s: string) => new TextEncoder().encode(s);

describe("upload screening", () => {
  it("validates type, extension and size", () => {
    expect(validateUpload("deck.pdf", "application/pdf", 1000)).toBeNull();
    expect(validateUpload("deck.exe", "application/pdf", 1000)).toMatch(/Accepted formats/);
    expect(validateUpload("deck.pdf", "application/x-msdownload", 1000)).toMatch(/Accepted formats/);
    expect(validateUpload("deck.pdf", "application/pdf", 0)).toMatch(/empty/);
    expect(validateUpload("deck.pdf", "application/pdf", 500 * 1024 * 1024)).toMatch(/MB/);
  });
  it("rejects content that does not match the declared type", async () => {
    const r = await screenUpload(enc("not a pdf"), "application/pdf");
    expect(r.quarantineStatus).toBe("held_for_review");
  });
  it("deletes the EICAR test file", async () => {
    const r = await screenUpload(enc("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"), "text/plain");
    expect(r.scanStatus).toBe("infected");
    expect(r.quarantineStatus).toBe("deleted");
  });
  it("flags restricted markings and keeps everything quarantined", async () => {
    expect((await screenUpload(enc("CUI//SP-PRVCY internal"), "text/plain")).quarantineStatus).toBe("held_for_review");
    expect((await screenUpload(enc("ITAR controlled"), "text/plain")).quarantineStatus).toBe("held_for_review");
    const clean = await screenUpload(enc("Our company overview"), "text/plain");
    expect(clean.quarantineStatus).toBe("quarantined");
    expect(clean.scanStatus).toBe("pending");
  });
  it("produces safe storage filenames", () => {
    expect(safeFilename("../../etc/passwd")).not.toContain("/");
    expect(safeFilename("Pitch Deck (v2).pdf")).toBe("pitch-deck-v2-.pdf");
  });
});

describe("jobs and events", () => {
  it("backs off exponentially with a cap", () => {
    expect([1, 2, 3].map(backoffSeconds)).toEqual([30, 60, 120]);
    expect(backoffSeconds(20)).toBe(3600);
  });
  it("defines every required event", () => {
    const required = ["application.created", "application.submitted", "document.uploaded", "intelligence.extracted", "research.completed", "assessment.generated", "assessment.approved", "opportunity.qualified", "proposal.generated", "proposal.approved", "proposal.accepted", "engagement.activated", "client.onboarded", "request.submitted", "production.started", "deliverable.rendered", "review.requested", "deliverable.approved", "deliverable.delivered", "report.generated", "subscription.updated"];
    expect(EVENT_CATALOG.map((e) => e.name).sort()).toEqual(required.sort());
    for (const e of EVENT_CATALOG) expect(e.requiredData.length).toBeGreaterThan(0);
  });
});

describe("planning scenario", () => {
  it("matches the stated planning assumptions", () => {
    const r = scenario(DEFAULT_SCENARIO);
    expect(r.revenue).toBe(35_000);
    expect(r.hoursPerClient).toBeCloseTo(3);
    expect(r.labor).toBeCloseTo(3_000);
    expect(r.software).toBe(500);
    expect(r.gross).toBeCloseTo(31_500);
  });
});

describe("auth helpers", () => {
  it("only allows same-site relative redirects", () => {
    expect(safeRedirect("/apply")).toBe("/apply");
    expect(safeRedirect("//evil.com")).toBe("/portal");
    expect(safeRedirect("https://evil.com")).toBe("/portal");
    expect(safeRedirect("/\\evil.com")).toBe("/portal");
  });
  it("signs and verifies payloads, rejecting tampering", () => {
    const t = signPayload({ sub: "u1" }, "session", 60);
    expect(verifyPayload<{ sub: string }>(t, "session")?.sub).toBe("u1");
    expect(verifyPayload(t, "download")).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", exp: 9e9 })).toString("base64url");
    expect(verifyPayload(`${forged}.${sig}`, "session")).toBeNull();
    expect(verifyPayload(`${body}.x`, "session")).toBeNull();
  });
});
