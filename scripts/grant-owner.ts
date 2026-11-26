/**
 * Grants an internal role to an existing user (they must have signed in once).
 *   npm run grant-owner -- someone@example.com [role]
 * Default role: platform_owner. Audited.
 */
import { withSystem, db } from "../src/lib/db.ts";
import { audit } from "../src/lib/audit.ts";

const [email, role = "platform_owner"] = process.argv.slice(2);
const ROLES = ["platform_owner", "administrator", "business_development", "strategist", "creative_producer", "reviewer", "finance"];

async function main() {
  if (!email) throw new Error("usage: npm run grant-owner -- <email> [role]");
  if (!ROLES.includes(role)) throw new Error(`role must be one of ${ROLES.join(", ")}`);
  await withSystem(async (tx) => {
    const [p] = await tx<{ id: string }[]>`select id from public.profiles where email = ${email.toLowerCase()}`;
    if (!p) throw new Error("No profile for that email. Ask the user to sign in once first.");
    await tx`insert into public.organization_memberships (organization_id, user_id, role)
             select id, ${p.id}, ${role} from public.organizations where kind = 'internal'
             on conflict (organization_id, user_id) do update set role = excluded.role`;
    await audit(tx, { action: "membership.granted", entityType: "profile", entityId: p.id, actorType: "system", metadata: { role, via: "cli" } });
  });
  console.log(`Granted ${role} to ${email}`);
  await db().end();
}

main().catch(async (e) => {
  console.error(e.message);
  await db().end();
  process.exit(1);
});
