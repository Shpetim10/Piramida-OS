-- Migration: remove OPERATIONS_MANAGER and TECHNICIAN roles (2026-06-21)
-- All staff now use the single EVENT_MANAGER role.

-- 1. Migrate any existing profile_roles that hold the removed role codes
--    to EVENT_MANAGER before we remove anything.
UPDATE "ProfileRole" pr
SET    "roleId" = r_em.id
FROM   "Role" r_old
JOIN   "Role" r_em ON r_em."orgId" = r_old."orgId" AND r_em.code = 'EVENT_MANAGER'
WHERE  pr."roleId" = r_old.id
  AND  r_old.code IN ('OPERATIONS_MANAGER', 'TECHNICIAN');

-- 2. Remove the role rows themselves (cascade deletes any remaining ProfileRole
--    that was not caught above, e.g. if EVENT_MANAGER row was missing in org).
DELETE FROM "Role" WHERE code IN ('OPERATIONS_MANAGER', 'TECHNICIAN');

-- 3. Drop the old enum values. Postgres requires recreating the enum type.
--    We rename the old type, create a new one with only the four values,
--    update all columns, then drop the old type.

ALTER TYPE "RoleCode" RENAME TO "RoleCode_old";

CREATE TYPE "RoleCode" AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'EVENT_MANAGER',
  'EVENT_ORGANIZER'
);

-- Update the Role.code column
ALTER TABLE "Role"
  ALTER COLUMN "code" TYPE "RoleCode" USING "code"::text::"RoleCode";

-- Update AuditLog.after/before are JSONB — no column type change needed.

DROP TYPE "RoleCode_old";
