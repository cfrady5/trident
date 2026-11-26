import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/trident_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Rebuild the e2e database, then start the app against it.
    command: `npx tsx scripts/migrate.ts --reset && npx tsx scripts/seed.ts && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/privacy`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_ENV: "test", APP_URL: `http://localhost:${PORT}`, DATABASE_URL,
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-12345", AUTH_PROVIDER: "local", STORAGE_PROVIDER: "local",
      LOCAL_STORAGE_DIR: ".data/e2e-storage", EMAIL_PROVIDER: "dev_outbox", AI_PROVIDER: "none",
      PLATFORM_OWNER_EMAILS: "owner@trident.test", STAFF_NOTIFICATION_EMAILS: "team@trident.test", CRON_SECRET: "e2e-cron-secret-123456",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
