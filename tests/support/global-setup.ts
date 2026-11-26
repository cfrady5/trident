import { execSync } from "node:child_process";

/** Rebuilds the test database from migrations + seed before DB tests run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/trident_test";
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx tsx scripts/migrate.ts --reset", { env, stdio: "pipe" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "pipe" });
}
