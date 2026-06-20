import {
  AssetReservationStatus,
  ConflictStatus,
  ConflictSeverity,
  ProposalStatus,
  PublicationStatus,
  GuestRegistrationStatus,
} from "@prisma/client";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { requirePermission, AuthError } from "../auth/guards";

// Deterministic launch-readiness gate evaluator. AI never decides readiness —
// each gate is computed from typed DB state. Critical unresolved conflicts and
// missing required reservations BLOCK; soft gaps WARN.

export type GateStatus = "go" | "warning" | "blocked";

export interface LaunchGate {
  key: string;
  label: string;
  status: GateStatus;
  message: string;
  blockers: string[];
}

export interface LaunchReadinessResult {
  eventId: string;
  overallStatus: GateStatus;
  readyForLaunch: boolean;
  gates: LaunchGate[];
}

function worst(statuses: GateStatus[]): GateStatus {
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("warning")) return "warning";
  return "go";
}

export async function getLaunchReadiness(eventId: string): Promise<LaunchReadinessResult> {
  await requirePermission("events.plan");
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId, deletedAt: null },
    include: {
      spaceReservations: true,
      assetReservations: { include: { items: true } },
      conflicts: true,
      tasks: true,
      proposals: true,
      publication: { include: { registrations: true } },
      requirements: true,
    },
  });
  if (!event) throw new AuthError("Event not found", 404);

  const inactive: AssetReservationStatus[] = [AssetReservationStatus.RELEASED, AssetReservationStatus.CANCELLED];
  const activeSpace = event.spaceReservations.filter((r) => !inactive.includes(r.status));
  const activeAssetItems = event.assetReservations
    .filter((r) => !inactive.includes(r.status))
    .flatMap((r) => r.items);

  const openConflicts = event.conflicts.filter((c) => c.status === ConflictStatus.OPEN);
  const criticalOpen = openConflicts.filter(
    (c) => c.severity === ConflictSeverity.CRITICAL || c.severity === ConflictSeverity.HIGH,
  );

  const gates: LaunchGate[] = [];

  // Space
  gates.push(
    activeSpace.length > 0
      ? gate("space", "Space", "go", `${activeSpace.length} space reservation(s) held`)
      : gate("space", "Space", "blocked", "No space reserved", ["Reserve at least one space"]),
  );

  // Assets
  const requiresAssets = event.requirements.some(
    (r) => ["wirelessMicrophones", "screens", "projectors", "speakers", "chairs", "tables"].includes(r.key) && Number(r.valueJson) > 0,
  );
  gates.push(
    activeAssetItems.length > 0
      ? gate("assets", "Assets", "go", `${activeAssetItems.length} asset line(s) reserved`)
      : requiresAssets
        ? gate("assets", "Assets", "blocked", "Required equipment not reserved", ["Reserve required assets"])
        : gate("assets", "Assets", "go", "No equipment required"),
  );

  // Power / cable
  const powerConflict = openConflicts.some((c) => c.type === "POWER_CABLE_RISK");
  gates.push(
    powerConflict
      ? gate("power", "Power", "warning", "Open power/cable risk", ["Reserve a cable safety kit"])
      : gate("power", "Power", "go", "No outstanding power/cable risk"),
  );

  // Staff / tasks
  const openTasks = event.tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status));
  gates.push(
    event.tasks.length === 0
      ? gate("staff", "Staff", "warning", "No tasks generated", ["Generate run-of-show tasks"])
      : openTasks.length === 0
        ? gate("staff", "Staff", "go", "All tasks complete")
        : gate("staff", "Staff", "warning", `${openTasks.length} task(s) still open`),
  );

  // Proposal
  const approvedProposal = event.proposals.some((p) => p.status === ProposalStatus.APPROVED);
  const sharedProposal = event.proposals.some((p) => p.status === ProposalStatus.SENT);
  gates.push(
    approvedProposal
      ? gate("proposal", "Proposal", "go", "Proposal approved")
      : sharedProposal
        ? gate("proposal", "Proposal", "warning", "Proposal shared, awaiting approval")
        : gate("proposal", "Proposal", "warning", "No approved proposal", ["Share and approve a proposal"]),
  );

  // Client
  gates.push(
    event.clientId
      ? gate("client", "Client", "go", "Client linked")
      : gate("client", "Client", "blocked", "No client linked", ["Link a client"]),
  );

  const publicEvent = event.publication !== null;
  const published = event.publication?.status === PublicationStatus.PUBLISHED;
  const needsRegistration = event.requirements.some((r) => r.key === "publicGuestRegistration" && r.valueJson === true);

  // Guest Page
  gates.push(
    !needsRegistration
      ? gate("guest_page", "Guest Page", "go", "No public page required")
      : published
        ? gate("guest_page", "Guest Page", "go", "Event published")
        : gate("guest_page", "Guest Page", "blocked", "Public registration required but event is not published", ["Publish the event"]),
  );

  // Registration
  const regOpen = event.publication?.registrationOpen ?? false;
  gates.push(
    !needsRegistration
      ? gate("registration", "Registration", "go", "Not applicable")
      : regOpen
        ? gate("registration", "Registration", "go", "Registration open")
        : gate("registration", "Registration", "warning", "Registration is not open"),
  );

  // Map
  const hasMap = publicEvent && event.publication?.publicMap && Object.keys(event.publication.publicMap as object).length > 0;
  gates.push(
    !needsRegistration
      ? gate("map", "Map", "go", "Not applicable")
      : hasMap
        ? gate("map", "Map", "go", "Guest map configured")
        : gate("map", "Map", "warning", "No guest map configured"),
  );

  // Safety
  const safetyConflict = openConflicts.some((c) => c.type === "POWER_CABLE_RISK" || c.type === "GUEST_FLOW_RISK");
  gates.push(
    safetyConflict
      ? gate("safety", "Safety", "warning", "Open safety-related risk")
      : gate("safety", "Safety", "go", "No outstanding safety risks"),
  );

  // Conflicts
  gates.push(
    criticalOpen.length > 0
      ? gate("conflicts", "Conflicts", "blocked", `${criticalOpen.length} critical conflict(s) open`, criticalOpen.map((c) => c.title))
      : openConflicts.length > 0
        ? gate("conflicts", "Conflicts", "warning", `${openConflicts.length} low/medium conflict(s) open`)
        : gate("conflicts", "Conflicts", "go", "No open conflicts"),
  );

  const overallStatus = worst(gates.map((g) => g.status));
  return {
    eventId,
    overallStatus,
    readyForLaunch: overallStatus !== "blocked",
    gates,
  };
}

function gate(key: string, label: string, status: GateStatus, message: string, blockers: string[] = []): LaunchGate {
  return { key, label, status, message, blockers };
}
