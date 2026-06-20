// Local, deterministic mock data for the Admin Control Center.
// No Supabase / AI — simulates organizer approvals, staff and permissions locally.
// Ported verbatim from the "Admin Control Center" Claude Design source.

export const LIME = "#C8F000";

// ---------- Organizer approvals ----------
export interface OrganizerApplication {
  id: string;
  company: string;
  org: string;
  title: string;
  initials: string;
  c: string;
  site: string;
  size: string;
  verified: boolean;
  prev: string;
  submitted: string;
  reason: string;
}

export const ORGANIZER_APPLICATIONS: OrganizerApplication[] = [
  {
    id: "lumen",
    company: "Lumen Labs",
    org: "Sara Kelmendi",
    title: "Founder & CEO",
    initials: "LL",
    c: "#C53A6B",
    site: "lumenlabs.al",
    size: "24 staff",
    verified: true,
    prev: "2 past events",
    submitted: "18 Jun 2026",
    reason:
      "Hosting our flagship NextGen Startup Summit for around 180 guests — full day, main stage for the keynote and investor panel, two breakout rooms, and a networking area with catering.",
  },
  {
    id: "adriatic",
    company: "Adriatic Ventures",
    org: "Marco Reinhardt",
    title: "Partner",
    initials: "AV",
    c: "#2A6FDB",
    site: "adriatic.vc",
    size: "12 staff",
    verified: true,
    prev: "New organizer",
    submitted: "16 Jun 2026",
    reason:
      "Quarterly investor day for our portfolio founders, roughly 90 guests. We need a boardroom-style room and a networking space with light catering.",
  },
  {
    id: "designhub",
    company: "Tirana Design Hub",
    org: "Elona Marku",
    title: "Programme Lead",
    initials: "DH",
    c: "#C0612A",
    site: "designhub.al",
    size: "8 staff",
    verified: false,
    prev: "New organizer",
    submitted: "14 Jun 2026",
    reason:
      "A weekend design biennale exhibition across the gallery spaces, expecting 300+ visitors with live demo stations and a small opening reception.",
  },
];

// ---------- Staff ----------
export const ROLE_COLOR: Record<string, string> = {
  "Event Manager": "#C8F000",
  "Operations Manager": "#2A6FDB",
  "Inventory Manager": "#7A4BD6",
  Technician: "#C0612A",
  "Finance Manager": "#1F8A5B",
  Administrator: "#EF4444",
};

export interface StaffMember {
  name: string;
  role: string;
  email: string;
  last: string;
  ini: string;
  c: string;
  baseDisabled?: boolean;
}

export const STAFF: StaffMember[] = [
  { name: "Erida Krasniqi", role: "Event Manager", email: "erida@pyramid.al", last: "2 min ago", ini: "EK", c: "#C8F000" },
  { name: "Marsel Leka", role: "Operations Manager", email: "marsel@pyramid.al", last: "10 min ago", ini: "ML", c: "#2A6FDB" },
  { name: "Drita Nushi", role: "Inventory Manager", email: "drita@pyramid.al", last: "1 hour ago", ini: "DN", c: "#7A4BD6" },
  { name: "Andi Prifti", role: "Technician", email: "andi@pyramid.al", last: "3 hours ago", ini: "AP", c: "#C0612A" },
  { name: "Gentian Reka", role: "Finance Manager", email: "gentian@pyramid.al", last: "yesterday", ini: "GR", c: "#1F8A5B" },
  { name: "Blerina Hoxha", role: "Technician", email: "blerina@pyramid.al", last: "14 days ago", ini: "BH", c: "#7D8799", baseDisabled: true },
];

// Slugify a staff name into a stable [profileId] for the edit route.
export function staffSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

export function findStaff(slug: string): StaffMember | undefined {
  return STAFF.find((s) => staffSlug(s.name) === slug);
}

// Roles assignable in the create/edit form.
export const ASSIGNABLE_ROLES = ["Event Manager", "Operations Manager", "Inventory Manager", "Technician", "Finance Manager"];

// ---------- Permissions ----------
export interface RoleDefinition {
  role: string;
  c: string;
  scope: string;
  caps: [string, number][];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "Event Manager",
    c: "#C8F000",
    scope: "The operational brain — owns the full event lifecycle.",
    caps: [["Review & generate events", 1], ["Allocate spaces & assets", 1], ["Resolve conflicts", 1], ["Run simulation & launch", 1], ["Assign tasks to staff", 1]],
  },
  {
    role: "Operations Manager",
    c: "#2A6FDB",
    scope: "Day-of execution and crew coordination.",
    caps: [["View all events", 1], ["Manage tasks & crew", 1], ["Edit space reservations", 1], ["Publish launches", 0]],
  },
  {
    role: "Inventory Manager",
    c: "#7A4BD6",
    scope: "Assets, stock and reservations.",
    caps: [["Manage inventory", 1], ["Reserve & release assets", 1], ["Resolve asset conflicts", 1], ["Edit events", 0]],
  },
  {
    role: "Technician",
    c: "#C0612A",
    scope: "On-the-ground setup and execution.",
    caps: [["View assigned tasks", 1], ["Update task status", 1], ["View space & asset detail", 1], ["Manage other staff", 0]],
  },
  {
    role: "Finance Manager",
    c: "#1F8A5B",
    scope: "Proposals, quotes and billing.",
    caps: [["View proposals & quotes", 1], ["Approve budgets", 1], ["Export financials", 1], ["Edit operations", 0]],
  },
  {
    role: "Administrator",
    c: "#EF4444",
    scope: "System configuration and access control.",
    caps: [["Approve organizers", 1], ["Manage staff & roles", 1], ["Configure permissions", 1], ["Full system access", 1]],
  },
];

// ---------- Header labels per screen ----------
export const ADMIN_LABELS: Record<string, [string, string]> = {
  approvals: ["ACCESS", "Organizer Approvals"],
  requests: ["INTAKE", "Event Requests"],
  staff: ["ACCESS", "Staff Management"],
  "staff-new": ["ACCESS", "New Staff Account"],
  "staff-edit": ["ACCESS", "Edit Staff Account"],
  permissions: ["ACCESS", "Permissions"],
};
