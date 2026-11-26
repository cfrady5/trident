import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  test("homepage communicates the value proposition and CTAs work", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Beyond the Award." })).toBeVisible();
    await expect(page.getByText("TECHNOLOGY COMMERCIALIZATION & CREATIVE AGENCY").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Awardable is not the same as adopted." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Innovation deserves a market." })).toBeVisible();
    await expect(page.getByText(/not affiliated with, endorsed by or acting on behalf of any government agency/).first()).toBeVisible();
    await page.getByRole("link", { name: /Assess your commercial readiness/ }).first().click();
    await expect(page).toHaveURL(/\/assessment$/);
  });

  test("every public page renders without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const path of ["/about", "/method", "/services", "/services/position", "/services/build", "/services/activate", "/marketplace", "/marketplace/build-kit", "/pricing", "/industries", "/industries/defense", "/industries/aerospace", "/industries/advanced-manufacturing", "/industries/emerging-technology", "/insights", "/insights/awardable-is-not-adopted", "/insights/exact-status-language", "/contact", "/apply", "/login", "/privacy", "/terms"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator("h1").first(), path).toBeVisible();
    }
    expect(errors).toEqual([]);
    expect((await page.goto("/marketplace/not-a-service"))?.status()).toBe(404);
  });

  test("marketplace filters, compares, shortlists and requests a proposal", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByText("19 of 19 services")).toBeVisible();
    await page.getByRole("button", { name: "Activate", exact: true }).click();
    await expect(page.getByText(/^\d+ of 19 services$/)).not.toHaveText("19 of 19 services");
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByLabel("Starting price").selectOption("u2500");
    const count = await page.locator("main li h2, main ul > li a.font-display").count();
    expect(count).toBeGreaterThan(0);
    await page.getByLabel("Starting price").selectOption("all");
    const compare = page.getByLabel("Compare");
    await compare.nth(0).check();
    await compare.nth(1).check();
    await expect(page.getByRole("region", { name: "Service comparison" })).toBeVisible();
    await page.getByRole("button", { name: "Shortlist", exact: true }).first().click();
    await expect(page.getByText("Shortlist · 1")).toBeVisible();
    await page.getByRole("link", { name: "Request a proposal" }).click();
    await expect(page.getByText("Services in this request")).toBeVisible();
    await page.getByLabel("Name").fill("Pat Buyer");
    await page.getByLabel("Business email").fill("pat@buyer.example");
    await page.getByLabel(/may contact me/).check();
    await page.getByRole("button", { name: "Request a proposal" }).click();
    await expect(page.getByText("Your request is with the Trident team")).toBeVisible();
  });

  test("readiness assessment produces a preliminary, explained result", async ({ page }) => {
    await page.goto("/assessment");
    const groups = page.locator("fieldset fieldset");
    const n = await groups.count();
    expect(n).toBe(16);
    for (let i = 0; i < n; i++) await groups.nth(i).locator("input[type=radio]").nth(1).check();
    await page.getByLabel("Your name").fill("Ria Respondent");
    await page.getByLabel("Business email").fill("ria@respondent.example");
    await page.getByLabel("Company").fill("Respondent Labs");
    await page.getByLabel(/Save my answers/).check();
    await page.getByRole("button", { name: "See my results" }).click();
    await expect(page).toHaveURL(/\/assessment\/results\//);
    await expect(page.getByText("Preliminary · self-assessment · not reviewed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Category breakdown" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Identified gaps/ })).toBeVisible();
    await expect(page.getByText(/not a government certification/).first()).toBeVisible();
    const json = await page.request.get(page.url().replace("/assessment/results/", "/api/assessments/"));
    expect(json.status()).toBe(200);
    expect((await json.json()).result.overall).toBeGreaterThan(0);
    // Without the token the results are private.
    expect((await page.goto(page.url().split("?")[0]!))?.status()).toBe(404);
  });
});
