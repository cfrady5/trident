import { expect, type Page } from "@playwright/test";

/** Passwordless sign-in through the dev provider: request a link, follow it. */
export async function signIn(page: Page, email: string, path = "/login", name?: string) {
  await page.goto(path);
  if (name) await page.getByLabel("Your name").first().fill(name);
  await page.getByLabel("Business email").fill(email);
  await page.getByRole("button", { name: /email me/i }).click();
  const link = page.getByTestId("dev-magic-link");
  await expect(link).toBeVisible();
  await page.goto((await link.getAttribute("href"))!);
}
