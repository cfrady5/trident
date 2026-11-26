import { expect, test } from "@playwright/test";
import path from "node:path";
import { signIn } from "./helpers";

const FOUNDER = "founder@orbital-optics.example";
let applicationUrl = "";

test.describe.serial("company application lifecycle", () => {
  test("applicant starts, saves, resumes, uploads and submits", async ({ page }) => {
    await signIn(page, FOUNDER, "/apply", "Olivia Founder");
    await expect(page).toHaveURL(/\/apply$/);
    await page.getByLabel("Company name").fill("Orbital Optics");
    await page.getByRole("button", { name: "Start application" }).click();
    await expect(page).toHaveURL(/\/apply\/[0-9a-f-]{36}$/);
    applicationUrl = page.url();

    // Stage 1
    await expect(page.getByRole("heading", { name: "Company identification" })).toBeVisible();
    await expect(page.getByLabel("Business email")).toHaveValue(FOUNDER);
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByText(/field\(s\) need attention/)).toBeVisible();
    await page.getByLabel("Website").fill("orbital-optics.example");
    await page.getByLabel("Primary industry").selectOption("aerospace");
    await page.getByLabel("Headquarters").fill("Boulder, CO");
    await page.getByLabel("Employees").selectOption("11-25");
    await page.getByLabel("Your role").fill("CEO");
    await page.getByLabel("Company stage").selectOption("seed");
    await expect(page.getByText(/^Saved /)).toBeVisible();

    // Resume: reload and confirm autosaved values persist.
    await page.reload();
    await expect(page.getByLabel("Headquarters")).toHaveValue("Boulder, CO");
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Stage 2
    await expect(page.getByRole("heading", { name: "Technology profile" })).toBeVisible();
    await page.getByLabel("Technology or product name").fill("StarLink Optical Terminal");
    await page.getByLabel("Describe the technology").fill("Compact laser communication terminals for small satellites.");
    await page.getByLabel(/What problem does it solve/).fill("Radio bandwidth limits for small satellite operators.");
    await page.getByLabel(/What makes it different/).fill("A third of the mass and power of incumbent terminals.");
    await page.getByLabel("Product maturity").selectOption("pilot");
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Stage 3 (conditional questions)
    await expect(page.getByRole("heading", { name: "Validation and traction" })).toBeVisible();
    await expect(page.getByLabel("Awarding agency")).toHaveCount(0);
    await page.getByLabel(/Small Business Innovation Research/).selectOption("awarded");
    await page.getByLabel("Awarding agency").fill("Air Force");
    await page.getByRole("button", { name: "Add a claim" }).click();
    await page.getByLabel("Exact wording").fill("Selected as Awardable on a solutions marketplace");
    await page.getByLabel("Date").fill("2026-04");
    await page.getByLabel("Public source URL").fill("https://example.org/listing/orbital");
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Stage 4
    await expect(page.getByRole("heading", { name: "Commercial objectives" })).toBeVisible();
    await page.getByLabel("Commercial operators").check();
    await page.getByLabel(/What would success look like/).fill("Two paid pilots with commercial satellite operators.");
    await page.getByLabel(/When do you need commercial traction/).selectOption("3_6");
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Stage 5 with file upload
    await expect(page.getByRole("heading", { name: "Brand and marketing" })).toBeVisible();
    await page.getByLabel("File type").selectOption("pitch_deck");
    await page.getByTestId("file-input").setInputFiles(path.resolve("tests/e2e/fixture.pdf"));
    await expect(page.getByText("fixture.pdf")).toBeVisible();
    await expect(page.getByText("Awaiting review")).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Stage 6
    await expect(page.getByRole("heading", { name: "Engagement preferences" })).toBeVisible();
    await page.getByLabel("Position Sprint").check();
    await page.getByLabel("Monthly marketing budget").selectOption("1500_3500");
    await page.getByLabel("One-time project budget").selectOption("2500_7500");
    await page.getByLabel("Your role in the decision").selectOption("decision_maker");
    await page.getByLabel(/Primary objectives/).fill("A clear position and a website buyers trust.");
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Stage 7 review
    await expect(page.getByRole("heading", { name: "Review and submit" })).toBeVisible();
    await expect(page.getByText("Boulder, CO")).toBeVisible();
    const submit = page.getByRole("button", { name: "Submit application" });
    await expect(submit).toBeDisabled();
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    await submit.click();
    await expect(page.getByText("Thank you. Your application is with the Trident team.")).toBeVisible();

    await page.goto("/portal");
    await expect(page.getByRole("heading", { name: "Orbital Optics" })).toBeVisible();
    await expect(page.getByRole("listitem").getByText("Submitted", { exact: true })).toBeVisible();
    // Submitted applications are read-only: no form fields, a status view instead.
    await page.goto(applicationUrl);
    await expect(page.getByText("Application submitted")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

  test("another applicant cannot reach this application or its files", async ({ page, request }) => {
    await signIn(page, "intruder@other.example");
    const res = await page.goto(applicationUrl);
    expect(res?.status()).toBe(404);
    const id = applicationUrl.split("/").pop()!;
    expect((await page.goto(`/portal/applications/${id}`))?.status()).toBe(404);
    expect((await page.goto("/command"))?.url()).toContain("/forbidden");
    // Unauthenticated API access is refused.
    expect((await request.post("/api/uploads", { multipart: { applicationId: id, category: "other" } })).status()).toBe(401);
    expect((await request.get("/api/jobs/run")).status()).toBe(401);
  });

  test("staff review the application in Trident Command", async ({ page }) => {
    await signIn(page, "owner@trident.test", "/login?next=/command");
    await expect(page).toHaveURL(/\/command$/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await page.goto("/command/applications");
    await page.getByRole("table").getByRole("link", { name: "Orbital Optics" }).click();
    await expect(page.getByText("Air Force")).toBeVisible();
    await expect(page.getByText("fixture.pdf")).toBeVisible();
    await page.getByLabel("New status").selectOption("needs_information");
    await page.getByLabel("Note").fill("Please add your LinkedIn page.");
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText("Information requested").first()).toBeVisible();

    await page.getByRole("link", { name: "Company profile →", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Orbital Optics" })).toBeVisible();
    // Qualification is blocked until the conflict-of-interest review clears.
    await page.getByLabel("Stage").first().selectOption("qualified");
    await expect(page.getByText(/conflict-of-interest review before qualifying/)).toBeVisible();
    for (const box of await page.locator("text=Conflict-of-interest review").locator("..").locator("..").getByRole("checkbox").all()) await box.check();
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByText("cleared").first()).toBeVisible();
    await page.getByLabel("Stage").first().selectOption("qualified");
    await expect(page.getByText(/Stage: .* → qualified/)).toBeVisible();
    await page.getByLabel("Text").fill("Discovery call next week.");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Discovery call next week.")).toBeVisible();

    await page.goto("/command/opportunities?view=kanban");
    await expect(page.getByRole("region", { name: "Qualified" }).getByText("Orbital Optics")).toBeVisible();
    await page.goto("/command/automations");
    await expect(page.getByText("application.submitted").first()).toBeVisible();
  });

  test("applicant sees the request and can update and resubmit", async ({ page }) => {
    await signIn(page, FOUNDER);
    await page.goto("/portal");
    await expect(page.getByText("Information requested")).toBeVisible();
    await page.getByRole("link", { name: "Continue →" }).click();
    await expect(page.getByText("The Trident team asked for more information")).toBeVisible();
    await expect(page.getByText("Please add your LinkedIn page.")).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("LinkedIn company page").fill("https://www.linkedin.com/company/orbital-optics");
    await expect(page.getByText(/^Saved /)).toBeVisible();
    await page.getByRole("button", { name: /Review and submit/ }).click();
    await expect(page.getByRole("heading", { name: "How we use this information" })).toBeVisible();
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Thank you. Your application is with the Trident team.")).toBeVisible();
  });
});
