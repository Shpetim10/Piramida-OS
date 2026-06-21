/**
 * Creates (or repairs) the Pyramid OS event manager account.
 *
 *  1. Creates a Supabase Auth user (email + password, email pre-confirmed).
 *  2. Upserts an application Profile linked to that auth user (STAFF, ACTIVE).
 *  3. Grants the EVENT_MANAGER role.
 *
 * Idempotent: re-running finds the existing auth user, resets its password to
 * the configured value, and re-links the profile/role.
 *
 * Run:  npm run manager:create
 * Override creds:  MANAGER_EMAIL=... MANAGER_PASSWORD=... npm run manager:create
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, and a seeded
 * org/roles (npm run db:seed) so the EVENT_MANAGER role exists.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ProfileStatus, ProfileType } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import { getOrgId } from "../lib/db/org";

const EMAIL = process.env.MANAGER_EMAIL ?? "events@pyramid.al";
const PASSWORD = process.env.MANAGER_PASSWORD ?? "Manager123!";
const FULL_NAME = process.env.MANAGER_NAME ?? "Erion Event";

async function resolveAuthUserId(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env",
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });

  if (!created.error && created.data.user) {
    console.log(`✓ Created Supabase auth user ${EMAIL}`);
    return created.data.user.id;
  }

  // Already exists — locate and reset password so creds are known.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const existing = data.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (!existing) throw created.error ?? new Error(`Could not create or find ${EMAIL}`);

  await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  console.log(`✓ Auth user ${EMAIL} already existed — password reset`);
  return existing.id;
}

async function main() {
  const authUserId = await resolveAuthUserId();
  const orgId = await getOrgId();

  const role = await prisma.role.findFirst({ where: { orgId, code: "EVENT_MANAGER" } });
  if (!role) throw new Error("EVENT_MANAGER role not found — run `npm run db:seed` first.");

  // Prefer updating the existing profile by email (created by seed with a
  // placeholder authUserId). Only create fresh if no email match exists.
  const existing = await prisma.profile.findFirst({
    where: { orgId, email: EMAIL, deletedAt: null },
  });

  let profile;
  if (existing) {
    profile = await prisma.profile.update({
      where: { id: existing.id },
      data: { authUserId, status: ProfileStatus.ACTIVE, type: ProfileType.STAFF, fullName: FULL_NAME },
    });
    console.log(`✓ Linked existing profile (${profile.id}) to Supabase auth user`);
  } else {
    profile = await prisma.profile.create({
      data: { orgId, authUserId, type: ProfileType.STAFF, status: ProfileStatus.ACTIVE, fullName: FULL_NAME, email: EMAIL },
    });
    console.log(`✓ Created new profile (${profile.id})`);
  }

  await prisma.profileRole.upsert({
    where: { profileId_roleId: { profileId: profile.id, roleId: role.id } },
    update: {},
    create: { orgId, profileId: profile.id, roleId: role.id },
  });

  console.log("✓ Event manager profile linked with EVENT_MANAGER role");
  console.log("");
  console.log("  Manager account ready:");
  console.log(`    email:    ${EMAIL}`);
  console.log(`    password: ${PASSWORD}`);
  console.log(`    profile:  ${profile.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("✗ create-manager failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
