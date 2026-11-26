# Security

## Independence and conflict of interest

- Trident is developed independently: no employer-owned software, private contact databases, confidential submissions, proprietary workflows or employer resources. Nothing in this repository was derived from such material; market figures come only from the public sources cited in the brand guide.
- **Gate (brand guide p.2/p.32):** the employer conflict-of-interest and outside-activity review must be cleared before the site is deployed publicly or any outreach is sent.
- Per-opportunity **conflict-of-interest review** in Command: four confirmations (no employer program relationship, no confidential information used, no employer resources used, not an employer counterparty). An opportunity **cannot move to qualified or beyond** until the review is `cleared` (enforced in `updateOpportunityAction`; tested e2e). Blocked reviews require a reason.
- Trident is never presented as affiliated with, endorsed by or acting for any agency or marketplace (disclaimer on every page footer and in every email).

## Authentication and sessions

- Passwordless only. Supabase Auth magic links in production (PKCE code exchange; `getUser()` validates the JWT server-side on each request).
- Local provider (dev/test only, refused when `APP_ENV=production`): 32-byte random single-use tokens, stored **hashed**, 15-minute expiry; session in an HMAC-SHA256 signed, httpOnly, `SameSite=Lax` cookie (Secure in production), 7-day expiry.
- Post-login redirects accept only same-site relative paths (`safeRedirect`, unit-tested).
- Rate limits (Postgres fixed window, hashed IP keys): sign-in 10/15 min per IP and 5/15 min per email; inquiries 5/h; assessments 8/h; uploads 30/h per user; autosave 240/min; website import 6/h.

## Authorization

- Every protected page calls `requireUser`/`requireStaff`; every Server Action and route handler re-checks the user server-side.
- **Every query runs under RLS** through `withUser`/`withAnon`; `withSystem` is used only after an RLS-scoped check or for system-owned tables. RLS is enabled on every public table (test asserts this).
- Records of other tenants return **404**, not 403, so existence isn't leaked.
- Tested (`tests/db/rls.test.ts`, `tests/e2e/application.spec.ts`): a client cannot read, update or insert into another tenant's applications, answers, companies, facts, credentials, files, organizations, consents or profiles; cannot join another org; cannot approve their own application or change review fields; cannot edit after submission; cannot upload a pre-released file; cannot read pipeline, audit, jobs, research, inquiries or `app_private`; cannot change prices; anon cannot read applications/companies; a second applicant gets 404 on another's application URLs and unauthenticated API calls get 401.
- A real privilege-escalation bug (SECURITY DEFINER guard trigger) was found by these tests and fixed before commit.

## Files

1. Type allow-list + extension match + size limit (`MAX_UPLOAD_MB`, default 25), Content-Length pre-check.
2. Magic-byte check against the declared type.
3. EICAR detection → rejected, bytes never stored.
4. SVG active content flagged.
5. **Restricted-content markers** in readable text (classification markings, CUI, ITAR/EAR/export control, distribution statements B–F, FOUO, third-party proprietary) → `held_for_review`.
6. Optional external malware scanner (`MALWARE_SCAN_URL`).
7. **Every file stays quarantined until a staff reviewer releases it.** Automated screening cannot reliably identify restricted content — compressed PDF streams and Office files hide text from byte inspection — so a person is the control, not the scanner.
8. Storage paths are server-generated (`orgs/{org}/applications/{app}/{uuid}-{safe-name}`); no client-supplied paths.
9. Downloads: RLS-checked lookup → 60-second signed URL; local driver serves `Content-Disposition: attachment`, `CSP: sandbox`, `nosniff`. Quarantined files are downloadable only by staff and the uploader. Every download is audited.
10. Deletion: clients via `request_file_deletion()` (role-checked), staff via review; bytes removed from storage on staff deletion.

The application explicitly instructs applicants not to submit classified information, CUI, export-controlled technical data or confidential third-party information, and records that attestation as a versioned consent.

## Public research (SSRF and terms)

- Only applicant-supplied public URLs, only with recorded consent.
- `assertPublicUrl`: http/https, default ports, no credentials; DNS resolved and private, loopback, link-local, CGNAT, multicast and cloud-metadata ranges refused; every redirect hop re-validated (max 3).
- robots.txt honoured for our user agent; 10-second timeouts; 1.5 MB cap; HTML only.
- No scraping of authenticated or restricted platforms. Public data source adapters must use official APIs/bulk data under their terms (`src/lib/intelligence/sources.ts`).
- Retrieved content is untrusted: never executed, never obeyed; AI prompts wrap it as data and models have no tools.

## Secrets

- `env.ts` validates configuration at runtime; `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `STRIPE_*`, `SESSION_SECRET`, `CRON_SECRET` are server-only (never `NEXT_PUBLIC_`). Settings page shows integration status, never values.
- `.env*` files are git-ignored; `.env.example` documents every variable.
- `/api/jobs/run` requires `Authorization: Bearer CRON_SECRET` (constant-time compare).

## HTTP hardening

`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `poweredByHeader: false`; non-production pages `noindex`. A full Content-Security-Policy with nonces is an open item.

## Audit

Append-only `audit_events` (trigger blocks update/delete): sign-ins, application create/submit/status changes, file upload/download/release/hold/delete, opportunity updates, COI decisions, credential/fact reviews, price changes (with before value), role grants/revocations, job retries, data requests.

## Privacy operations

- Versioned consents recorded per application (processing, public research, no-restricted-information attestation) and per assessment.
- Data export and deletion requests from `/portal/settings`, processed by an administrator in `/command/settings` (fulfilment manual in Phase 1).
- Retention defaults are `[CONFIRM]` (see DATABASE.md).

## Known gaps (tracked in PROGRESS.md)

- Supabase Auth/Storage, Resend and Anthropic code paths are implemented but untested against live services.
- No external malware scanner connected.
- No nonce-based CSP yet; no automated retention/deletion jobs yet; no MFA for staff (Supabase supports it — enable before launch).
- Rate limiter is fixed-window in Postgres; adequate for current scale.
