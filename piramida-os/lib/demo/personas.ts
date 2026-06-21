import { createHash } from "node:crypto";

// Mirrors prisma/seed.ts sid(): stable UUID from a semantic key. Keep in sync —
// these must resolve to the exact profile ids the seed creates so DEMO_MODE
// login (cookie `demo_auth` = profile.authUserId = profile.id) finds a real row.
function sid(key: string): string {
  const h = createHash("sha1").update(`piramida:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "5" + h.slice(13, 16),
    "8" + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

export interface DemoPersona {
  key: string;
  label: string;
  role: string;
  profileId: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { key: "profile:admin", label: "Ada Admin", role: "ADMIN" },
  { key: "profile:event-mgr", label: "Erion Event", role: "EVENT_MANAGER" },
  { key: "profile:organizer", label: "Lena Organizer", role: "EVENT_ORGANIZER" },
].map((p) => ({ ...p, profileId: sid(p.key) }));

export const DEMO_COOKIE = "demo_auth";
