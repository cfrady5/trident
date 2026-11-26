/**
 * Tenant isolation and permission tests against real PostgreSQL with the
 * production RLS policies. Every query here runs as the `authenticated` or
 * `anon` role exactly as the application does.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, withAnon, withSystem, withUser } from "@/lib/db";
import { saveAnswers, startApplication, submitApplication } from "@/lib/application/service";
import { allConsents, completeAnswers, createUser, makeStaff } from "../support/fixtures";
import type { CurrentUser } from "@/lib/auth";

let alice: CurrentUser, bob: CurrentUser, staff: CurrentUser;
let aliceApp: string, bobApp: string, aliceOrg: string, aliceFile: string, aliceCompany: string;

beforeAll(async () => {
  alice = await createUser("alice@acme-photonics.example", "Alice");
  bob = await createUser("bob@zenith.example", "Bob");
  staff = await makeStaff(await createUser("strategist@trident.test", "Sam"), "strategist");
  aliceApp = await startApplication(alice, { companyName: "Acme Photonics" });
  bobApp = await startApplication(bob, { companyName: "Zenith Robotics" });
  await saveAnswers(alice.id, aliceApp, completeAnswers());
  const [a] = await withSystem((tx) => tx<{ organization_id: string }[]>`select organization_id from public.applications where id = ${aliceApp}`);
  aliceOrg = a!.organization_id;
  const [f] = await withUser(alice.id, (tx) => tx<{ id: string }[]>`
    insert into public.files (organization_id, application_id, uploaded_by, bucket, storage_path, original_name, content_type, size_bytes, sha256)
    values (${aliceOrg}, ${aliceApp}, ${alice.id}, 'b', ${`orgs/${aliceOrg}/x.pdf`}, 'x.pdf', 'application/pdf', 10, 'abc') returning id`);
  aliceFile = f!.id;
  aliceCompany = (await submitApplication(alice, aliceApp, allConsents)).companyId;
});

afterAll(async () => {
  await db().end();
});

describe("schema hygiene", () => {
  it("enables RLS on every public table", async () => {
    const rows = await withSystem((tx) => tx<{ tablename: string }[]>`
      select c.relname as tablename from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });
});

describe("cross-tenant isolation", () => {
  it("hides another client's application, answers, company, facts and files", async () => {
    await withUser(bob.id, async (tx) => {
      expect(await tx`select 1 from public.applications where id = ${aliceApp}`).toHaveLength(0);
      expect(await tx`select 1 from public.application_answers where application_id = ${aliceApp}`).toHaveLength(0);
      expect(await tx`select 1 from public.companies where id = ${aliceCompany}`).toHaveLength(0);
      expect(await tx`select 1 from public.company_facts where company_id = ${aliceCompany}`).toHaveLength(0);
      expect(await tx`select 1 from public.credentials where company_id = ${aliceCompany}`).toHaveLength(0);
      expect(await tx`select 1 from public.files where id = ${aliceFile}`).toHaveLength(0);
      expect(await tx`select 1 from public.organizations where id = ${aliceOrg}`).toHaveLength(0);
      expect(await tx`select 1 from public.consent_records where subject_id = ${aliceApp}`).toHaveLength(0);
      expect(await tx`select 1 from public.profiles where id = ${alice.id}`).toHaveLength(0);
    });
  });

  it("silently ignores updates to another client's application", async () => {
    const r = await withUser(bob.id, (tx) => tx`update public.applications set current_stage = 3 where id = ${aliceApp} returning id`);
    expect(r).toHaveLength(0);
  });

  it("refuses writes into another tenant", async () => {
    await expect(withUser(bob.id, (tx) => tx`insert into public.application_answers (application_id, question_key, value, updated_by) values (${aliceApp}, 'company_name', '"x"', ${bob.id})`)).rejects.toThrow(/row-level security/);
    await expect(withUser(bob.id, (tx) => tx`
      insert into public.files (organization_id, uploaded_by, bucket, storage_path, original_name, content_type, size_bytes, sha256)
      values (${aliceOrg}, ${bob.id}, 'b', 'orgs/x/evil.pdf', 'e.pdf', 'application/pdf', 1, 'x')`)).rejects.toThrow(/row-level security/);
    await expect(withUser(bob.id, (tx) => tx`insert into public.applications (organization_id, created_by) values (${aliceOrg}, ${bob.id})`)).rejects.toThrow(/row-level security/);
    await expect(withUser(bob.id, (tx) => tx`select app_private.request_file_deletion(${aliceFile})`)).rejects.toThrow(/not authorized/);
  });

  it("prevents a client from joining another organization", async () => {
    await expect(withUser(bob.id, (tx) => tx`insert into public.organization_memberships (organization_id, user_id, role) values (${aliceOrg}, ${bob.id}, 'client_admin')`)).rejects.toThrow(/row-level security/);
  });

  it("lets the owner see their own records", async () => {
    await withUser(alice.id, async (tx) => {
      expect(await tx`select 1 from public.applications where id = ${aliceApp}`).toHaveLength(1);
      expect(await tx`select 1 from public.companies where id = ${aliceCompany}`).toHaveLength(1);
      expect(await tx`select 1 from public.files where id = ${aliceFile}`).toHaveLength(1);
    });
  });
});

describe("applicant permissions", () => {
  it("cannot approve their own application or change review fields", async () => {
    await expect(withUser(bob.id, (tx) => tx`update public.applications set status = 'accepted', submitted_at = now() where id = ${bobApp}`)).rejects.toThrow(/invalid status transition/);
    const [still] = await withSystem((tx) => tx<{ status: string }[]>`select status from public.applications where id = ${bobApp}`);
    expect(still!.status).toBe("draft");
    await expect(withUser(bob.id, (tx) => tx`update public.applications set reviewed_by = ${bob.id} where id = ${bobApp}`)).rejects.toThrow(/not editable/);
  });

  it("cannot edit an application after submission", async () => {
    await expect(saveAnswers(alice.id, aliceApp, { headquarters: "Elsewhere" })).rejects.toThrow(/can no longer be edited/);
    const r = await withUser(alice.id, (tx) => tx`update public.application_answers set value = '"x"' where application_id = ${aliceApp} returning id`);
    expect(r).toHaveLength(0);
  });

  it("cannot upload a file pre-released from quarantine", async () => {
    const [b] = await withSystem((tx) => tx<{ organization_id: string }[]>`select organization_id from public.applications where id = ${bobApp}`);
    await expect(withUser(bob.id, (tx) => tx`
      insert into public.files (organization_id, application_id, uploaded_by, bucket, storage_path, original_name, content_type, size_bytes, sha256, quarantine_status)
      values (${b!.organization_id}, ${bobApp}, ${bob.id}, 'b', 'orgs/y/a.pdf', 'a.pdf', 'application/pdf', 1, 'x', 'released')`)).rejects.toThrow(/row-level security/);
  });

  it("cannot see internal records: pipeline, audit, jobs, research, inquiries", async () => {
    for (const t of ["opportunities", "pipeline_activities", "audit_events", "jobs", "domain_events", "automation_runs", "company_intelligence_records", "intelligence_sources", "inquiries", "conflict_of_interest_reviews"]) {
      expect(await withUser(alice.id, (tx) => tx.unsafe(`select 1 from public.${t}`)), t).toHaveLength(0);
    }
  });

  it("staff can read inquiries", async () => {
    await withSystem((tx) => tx`insert into public.inquiries (kind, full_name, email, consent_contact) values ('contact', 'Q', 'q@x.example', true)`);
    expect((await withUser(staff.id, (tx) => tx`select 1 from public.inquiries`)).length).toBeGreaterThan(0);
  });

  it("cannot read app_private tables", async () => {
    await expect(withUser(alice.id, (tx) => tx`select * from app_private.local_auth_tokens`)).rejects.toThrow(/permission denied/);
    await expect(withUser(alice.id, (tx) => tx`select * from app_private.dev_outbox`)).rejects.toThrow(/permission denied/);
  });

  it("cannot edit the catalog", async () => {
    const r = await withUser(alice.id, (tx) => tx`update public.services set starting_price_cents = 1 returning id`);
    expect(r).toHaveLength(0);
  });
});

describe("anonymous access", () => {
  it("can read the published catalog and active framework only", async () => {
    await withAnon(async (tx) => {
      expect((await tx`select 1 from public.services where is_published`).length).toBe(19);
      expect((await tx`select 1 from public.assessment_criteria`).length).toBe(16);
    });
    await expect(withAnon((tx) => tx`select 1 from public.applications`)).rejects.toThrow(/permission denied/);
    await expect(withAnon((tx) => tx`select 1 from public.companies`)).rejects.toThrow(/permission denied/);
  });
});

describe("staff access", () => {
  it("can read across tenants and see the pipeline", async () => {
    await withUser(staff.id, async (tx) => {
      expect(await tx`select 1 from public.applications where id = ${aliceApp}`).toHaveLength(1);
      expect(await tx`select 1 from public.opportunities where company_id = ${aliceCompany}`).toHaveLength(1);
    });
  });

  it("strategists cannot change pricing; finance can", async () => {
    expect(await withUser(staff.id, (tx) => tx`update public.services set starting_price_cents = 1 where slug = 'landing-page' returning id`)).toHaveLength(0);
    const fin = await makeStaff(await createUser("finance@trident.test"), "finance");
    expect(await withUser(fin.id, (tx) => tx`update public.services set starting_price_cents = 160000 where slug = 'landing-page' returning id`)).toHaveLength(1);
  });

  it("cannot write automation records directly", async () => {
    await expect(withUser(staff.id, (tx) => tx`insert into public.jobs (kind, idempotency_key) values ('research.initial', 'x')`)).rejects.toThrow(/permission denied/);
  });
});

describe("data integrity rules", () => {
  it("never stores AI output as approved without a human approver", async () => {
    await expect(withSystem((tx) => tx`
      insert into public.company_facts (company_id, section, fact_key, value, provenance, approval_status)
      values (${aliceCompany}, 'market', 'ai_guess', '"x"', 'ai_generated', 'approved')`)).rejects.toThrow(/company_facts_ai_needs_human/);
  });
  it("audit events are append-only", async () => {
    await expect(withSystem((tx) => tx`update public.audit_events set action = 'x.y'`)).rejects.toThrow(/append-only/);
    await expect(withSystem((tx) => tx`delete from public.audit_events`)).rejects.toThrow(/append-only/);
  });
  it("credentials cannot be verified without a verifier", async () => {
    await expect(withSystem((tx) => tx`update public.credentials set verification_status = 'verified' where company_id = ${aliceCompany}`)).rejects.toThrow(/credentials_verified_has_verifier/);
  });
  it("proposals cannot be sent without an approver", async () => {
    await expect(withSystem((tx) => tx`insert into public.proposals (company_id, title, status) values (${aliceCompany}, 'P', 'sent')`)).rejects.toThrow(/proposals_sent_requires_approval/);
  });
  it("client roles cannot be granted in the internal organization", async () => {
    await expect(withSystem((tx) => tx`insert into public.organization_memberships (organization_id, user_id, role) select id, ${bob.id}, 'client_admin' from public.organizations where kind = 'internal'`)).rejects.toThrow(/client roles are not valid/);
  });
});
