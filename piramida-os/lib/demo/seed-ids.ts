import { createHash } from "node:crypto";

/** Stable UUID from a semantic key — mirrors prisma/seed.ts sid(). */
export function demoSeedId(key: string): string {
  const h = createHash("sha1").update(`piramida:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "5" + h.slice(13, 16),
    "8" + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

export const DEMO_EVENT_STARTUP = demoSeedId("event:startup");
export const DEMO_CONFLICT_WMIC = demoSeedId("conflict:wmic-04");
export const DEMO_PROFILE_EVENT_MGR = demoSeedId("profile:event-mgr");
