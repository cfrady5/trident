/**
 * Applies supabase/migrations/*.sql in order, tracking them in
 * trident_meta.migrations. Against a local database it first applies the
 * Supabase compatibility shim (supabase/local/bootstrap.sql).
 * On Supabase you may instead use `supabase db push`; both are equivalent.
 *
 *   tsx scripts/migrate.ts            apply pending migrations
 *   tsx scripts/migrate.ts --reset    LOCAL ONLY: drop and recreate everything
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const reset = process.argv.includes("--reset");
const sql = postgres(url, { onnotice: () => {}, max: 1 });

async function main() {
  if (reset) {
    if (!isLocal) throw new Error("--reset is only allowed against a local database");
    await sql.unsafe(`
      drop schema if exists public cascade; create schema public;
      drop schema if exists app_private cascade;
      drop schema if exists trident_meta cascade;
      drop schema if exists auth cascade;
      drop type if exists public.org_kind cascade;
    `);
    console.log("reset: schemas dropped");
  }
  const hasAuth = await sql`select 1 from information_schema.schemata where schema_name = 'auth'`;
  if (hasAuth.length === 0) {
    if (!isLocal) throw new Error("auth schema missing on a non-local database; is this a Supabase project?");
    await sql.unsafe(readFileSync("supabase/local/bootstrap.sql", "utf8"));
    console.log("applied local Supabase shim");
  }
  await sql.unsafe(`
    create schema if not exists trident_meta;
    create table if not exists trident_meta.migrations (name text primary key, applied_at timestamptz not null default now());
  `);
  const done = new Set((await sql`select name from trident_meta.migrations`).map((r) => r.name as string));
  const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const body = readFileSync(join("supabase/migrations", file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into trident_meta.migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
  console.log("migrations up to date");
}

main().then(() => sql.end()).catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
