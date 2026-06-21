import type { RoleCode } from "@prisma/client";

// Single source of truth for RBAC. Server-side checks (requirePermission /
// requireRole) derive capabilities from this matrix. UI hiding is never
// security — every mutation of operational truth must call these helpers.
//
// Role decisions: FINANCE_MANAGER and INVENTORY_MANAGER merged into EVENT_MANAGER
// (2026-06-20). OPERATIONS_MANAGER and TECHNICIAN also merged into EVENT_MANAGER
// (2026-06-21). All staff now use a single EVENT_MANAGER role.

export const PERMISSIONS = [
  "profiles.manage",
  "roles.manage",
  "clients.manage",
  "requests.submit",
  "requests.review",
  "events.plan",
  "inventory.manage",
  "inventory.scan",
  "conflicts.resolve",
  "tasks.manage",
  "quotes.manage",
  "proposals.manage",
  "events.publish",
  "checkin.scan",
  "audit.read",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF_PLANNING: Permission[] = [
  "events.plan",
  "conflicts.resolve",
  "tasks.manage",
];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  // Break-glass / platform owner — everything.
  SUPER_ADMIN: [...PERMISSIONS],

  ADMIN: [...PERMISSIONS],

  // Absorbs former Inventory Manager + Finance Manager responsibilities.
  EVENT_MANAGER: [
    "clients.manage",
    "requests.submit",
    "requests.review",
    ...STAFF_PLANNING,
    "inventory.manage",
    "inventory.scan",
    "quotes.manage",
    "proposals.manage",
    "events.publish",
    "checkin.scan",
  ],

  // External client persona — scoped to OWN records via row-level ownership
  // checks, not via this matrix.
  EVENT_ORGANIZER: ["requests.submit"],
};

export function permissionsForRoles(roles: RoleCode[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) {
    for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  }
  return set;
}

export function hasPermission(
  roles: RoleCode[],
  permission: Permission,
): boolean {
  return permissionsForRoles(roles).has(permission);
}
