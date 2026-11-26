# Trident

**Beyond the Award.** Technology commercialization & creative agency — website, marketplace, Commercial Readiness Index, company application, CRM, client portal and Trident Command, on one data model.

> ⚠ **Do not deploy publicly yet.** The brand guide's gate (employer conflict-of-interest / outside-activity review) must clear first. See BRAND.md and ROADMAP.md → Gate 0.

## Quick start (local, no external services)

Requirements: Node 22+, PostgreSQL 16 binaries (the setup script runs a private cluster).

```bash
npm install
npm run db:local                       # Postgres on 127.0.0.1:54329
cp .env.example .env.local             # then set SESSION_SECRET (32+ chars) and PLATFORM_OWNER_EMAILS
set -a && . ./.env.local && set +a && npm run db:reset
npm run dev                            # http://localhost:3000
```

Sign in at `/login` with the email from `PLATFORM_OWNER_EMAILS` (the dev magic link appears on screen and at `/dev/outbox`) to reach `/command`. Background jobs run automatically after an application is submitted; `npm run worker` processes anything left in the queue.

Development mode is explicit: local auth, local storage, email outbox and AI off are shown in a banner on every page and refused when `APP_ENV=production`.

## Tests

```bash
npm run typecheck && npm run lint
npm test            # 69 unit + database tests (RLS tenant isolation on real Postgres)
npm run test:e2e    # 8 Playwright end-to-end tests (public site, assessment, full application lifecycle, staff review, isolation)
```

## Deploy (Vercel + Supabase) — after Gate 0

1. **Supabase:** create a project. Run the migrations (`DATABASE_URL=<direct connection> npm run db:migrate`, or `supabase db push`), then `npm run db:seed`. Create a **private** Storage bucket `trident-private`. In Auth, enable email magic links, set Site URL to `APP_URL` and add `${APP_URL}/auth/callback` to redirect URLs; brand the email template (Arial, Bronze links, no exclamation marks — VOICE.md). Enable MFA for staff.
2. **Resend:** verify the sending domain; set `EMAIL_FROM`.
3. **Vercel:** import the repo; set every variable in `.env.example` with `APP_ENV=production`, `AUTH_PROVIDER=supabase`, `STORAGE_PROVIDER=supabase`, `EMAIL_PROVIDER=resend`, a random `SESSION_SECRET` and `CRON_SECRET`. Use the Supabase **transaction pooler** URL for `DATABASE_URL` (`prepare: false` is already set). `vercel.json` schedules `/api/jobs/run` every 5 minutes (Vercel Pro; Hobby allows daily only — run `npm run worker` elsewhere if needed).
4. **AI (optional):** `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD`.
5. First owner: add your email to `PLATFORM_OWNER_EMAILS` and sign in, or run `npm run grant-owner -- you@company.com`.
6. Smoke test: sign in, submit a test application, confirm the applicant email arrives, the research run appears in `/command/intelligence`, and a second account receives 404 on the first account's application URL.

## Documentation

| File | What |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Rules and commands for working in this repo |
| [BRAND.md](BRAND.md) | Brand extraction with approval status and open decisions |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Tokens, type, contrast, components, states |
| [VOICE.md](VOICE.md) | Voice, guardrails, approved copy |
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | Modules, catalog, application, index, pipeline, acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, data contexts, integration boundaries |
| [DATABASE.md](DATABASE.md) | Schema, RLS model, constraints |
| [AUTOMATION.md](AUTOMATION.md) | Events, jobs, workflows, AI rules |
| [SECURITY.md](SECURITY.md) | Threat controls, uploads, SSRF, COI |
| [ROADMAP.md](ROADMAP.md) | Phases, acceptance criteria, backlog |
| [PROGRESS.md](PROGRESS.md) | Current status, decisions, test results, next priority |
