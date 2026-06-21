-- Migration: remove OPERATIONS_MANAGER and TECHNICIAN roles (2026-06-21)
-- All staff now use the single EVENT_MANAGER role.

-- 1. Migrate any existing profile_roles that hold the removed role codes
--    to EVENT_MANAGER before we remove anything.
UPDATE profile_roles pr
SET    role_id = r_em.id
FROM   roles r_old
JOIN   roles r_em ON r_em.org_id = r_old.org_id AND r_em.code = 'EVENT_MANAGER'
WHERE  pr.role_id = r_old.id
  AND  r_old.code IN ('OPERATIONS_MANAGER', 'TECHNICIAN');

-- 2. Remove the role rows themselves (cascade deletes any remaining profile_roles
--    that was not caught above, e.g. if EVENT_MANAGER row was missing in org).
DELETE FROM roles WHERE code IN ('OPERATIONS_MANAGER', 'TECHNICIAN');

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

-- Update the roles.code column
ALTER TABLE roles
  ALTER COLUMN code TYPE "RoleCode" USING code::text::"RoleCode";

DROP TYPE "RoleCode_old";
