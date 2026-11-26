# CLAUDE.md — working in the Trident repository

Read `AGENTS.md` (Next.js 16 differs from older training data; docs live in `node_modules/next/dist/docs/`). Then this file.

## What this is

Trident: a technology commercialization & creative agency website plus its operating system (marketplace, readiness index, application, CRM, client portal, Command). Next.js 16 App Router · TypeScript strict · Tailwind 4 · Postgres (Supabase) with RLS · Vitest · Playwright.

Docs: BRAND.md · DESIGN_SYSTEM.md · VOICE.md · PRODUCT_SPEC.md · ARCHITECTURE.md · DATABASE.md · AUTOMATION.md · SECURITY.md · ROADMAP.md · PROGRESS.md (keep PROGRESS.md current after every work session).

## Commands

```bash
npm run db:local        # start local Postgres 16 on 127.0.0.1:54329 (dbs: trident, trident_test)
npm run db:reset        # LOCAL ONLY: drop + migrate + seed (DATABASE_URL from env)
npm run dev             # http://localhost:3000 (uses .env.local)
npm run typecheck && npm run lint
npm test                # unit + DB/RLS tests (rebuilds trident_test)
npm run test:e2e        # Playwright; starts its own server on :3100 with trident_e2e
npm run worker          # process background jobs locally
npm run grant-owner -- you@example.com [role]
```

Dev sign-in: request a link at `/login`; in dev the link is shown on screen and in `/dev/outbox`. Emails in `PLATFORM_OWNER_EMAILS` become platform owners on first sign-in.

## Non-negotiable rules

1. **Brand guardrails.** Never imply government endorsement, never call a marketplace selection a contract, no agency seals, no fake metrics/testimonials/logos/case studies, no invented facts. Use `[CONFIRM: …]` for unknowns. Voice rules in VOICE.md (sentence case, no exclamation marks, no serial comma, acronyms spelled out first).
2. **Logo:** only the supplied artwork in `public/brand/` via `<Logo>`. Never retype, redraw or restyle the wordmark.
3. **Colors/type only from tokens** in `globals.css`. Gold on dark only; Bronze is the only accent on Ivory.
4. **Data access:** every query goes through `withUser`, `withAnon` or `withSystem` (`src/lib/db.ts`). Use `withSystem` only after an RLS-scoped authorization check or for system-owned tables. New tables: enable RLS and add policies in a new migration; add a test in `tests/db/rls.test.ts`.
5. **Server-side authorization** on every page, action and route (`requireUser`, `requireStaff`, `hasStaffRole`). Never trust client input; validate with Zod.
6. **Deterministic code** for scoring, pricing, permissions, transitions and contract terms. AI only via `runStructured` (schema, no tools, cost recorded); AI output never becomes an approved fact or client-facing content without human review.
7. **No simulated integrations.** If a provider isn't configured, record the step as blocked/skipped and say so in the UI.
8. **Events and jobs** must be idempotent (`emitEvent` inside the state-changing transaction; deterministic idempotency keys).
9. Never commit secrets; `.env*` is ignored. Never expose server keys via `NEXT_PUBLIC_`.
10. Migrations are append-only once deployed. (Until first deploy they may be edited, then `npm run db:reset`.)

## Conventions

- Next 16: `params`/`searchParams`/`cookies()`/`headers()` are async; use `PageProps<"/route">` / `RouteContext<"/route">` helpers; `proxy.ts` replaces middleware.
- Server Actions return `ActionResult` (`src/lib/errors.ts`); user-facing messages are plain, specific and never leak internals.
- Copy lives in `src/content/*`; the catalog and readiness framework are seeds — the database is the source of truth afterwards.
- Client-facing status language: `src/lib/status.ts`.
- Tests: add unit tests for pure logic, DB tests for anything touching RLS or the submission pipeline, e2e for user flows.
