import {
  AssetReservationStatus,
  ConflictStatus,
  ConflictSeverity,
  ProposalStatus,
  PublicationStatus,
} from "@prisma/client";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { requirePermission, AuthError } from "../auth/guards";

// Deterministic launch-readiness gate evaluator. AI never decides readiness —
// each gate is computed from typed DB state. Critical gates block launch when
// BLOCKED; non-critical gates only produce warnings.
//
// Single gate-truth function: getLaunchReadiness(eventId). UI renders verbatim.

export type GateStatus = "go" | "warning" | "blocked";

export interface LaunchGate {
  key: string;
  label: string;
  status: GateStatus;
  critical: boolean;
  message: string;
  blockers: string[];
  /** Single action to unblock this gate, shown in the Path-to-GO panel. */
  nextAction?: string;
}

export interface LaunchReadinessResult {
  eventId: string;
  overallStatus: GateStatus;
  /** true when all critical gates are GO (warnings on critical or any state on non-critical is OK). */
  readyForLaunch: boolean;
  gates: LaunchGate[];
  /** Ordered list of blocked gates with the single action to take. */
  pathToGo: Array<{ gateKey: string; label: string; action: string; critical: boolean }>;
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

  // Space (critical)
  gates.push(
    activeSpace.length > 0
      ? gate("space", "Space", "go", true, `${activeSpace.length} space reservation(s) held`)
      : gate("space", "Space", "blocked", true, "No space reserved", ["Reserve at least one space"], "Go to Simulate → generate a plan and reserve spaces"),
  );

  // Assets (critical)
  const requiresAssets = event.requirements.some(
    (r) => ["wirelessMicrophones", "screens", "projectors", "speakers", "chairs", "tables"].includes(r.key) && Number(r.valueJson) > 0,
  );
  gates.push(
    activeAssetItems.length > 0
      ? gate("assets", "Assets", "go", true, `${activeAssetItems.length} asset line(s) reserved`)
      : requiresAssets
        ? gate("assets", "Assets", "blocked", true, "Required equipment not reserved", ["Reserve required assets"], "Go to Protect → run conflict detection and reserve assets")
        : gate("assets", "Assets", "go", true, "No equipment required"),
  );

  // Power / cable (non-critical)
  const powerConflict = openConflicts.some((c) => c.type === "POWER_CABLE_RISK");
  gates.push(
    powerConflict
      ? gate("power", "Power", "warning", false, "Open power/cable risk", [], "Protect → apply 'Reserve Cable Kit A' fix")
      : gate("power", "Power", "go", false, "No outstanding power/cable risk"),
  );

  // Staff / tasks (non-critical)
  const openTasks = event.tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status));
  gates.push(
    event.tasks.length === 0
      ? gate("staff", "Staff", "warning", false, "No tasks generated", [], "Run planning engine to generate run-of-show tasks")
      : openTasks.length === 0
        ? gate("staff", "Staff", "go", false, "All tasks complete")
        : gate("staff", "Staff", "warning", false, `${openTasks.length} task(s) still open`),
  );

  // Proposal (non-critical)
  const approvedProposal = event.proposals.some((p) => p.status === ProposalStatus.APPROVED);
  const sharedProposal = event.proposals.some((p) => p.status === ProposalStatus.SENT);
  gates.push(
    approvedProposal
      ? gate("proposal", "Proposal", "go", false, "Proposal approved")
      : sharedProposal
        ? gate("proposal", "Proposal", "warning", false, "Proposal shared, awaiting approval")
        : gate("proposal", "Proposal", "warning", false, "No approved proposal", [], "Explain → generate and share proposal with organizer"),
  );

  // Client (critical)
  gates.push(
    event.clientId
      ? gate("client", "Client", "go", true, "Client linked")
      : gate("client", "Client", "blocked", true, "No client linked", ["Link a client"], "Link a client to this event in event settings"),
  );

  const publicEvent = event.publication !== null;
  const published = event.publication?.status === PublicationStatus.PUBLISHED;
  const needsRegistration = event.requirements.some((r) => r.key === "publicGuestRegistration" && r.valueJson === true);

  // Guest Page (critical when registration required)
  gates.push(
    !needsRegistration
      ? gate("guest_page", "Guest Page", "go", false, "No public page required")
      : published
        ? gate("guest_page", "Guest Page", "go", true, "Event published")
        : gate("guest_page", "Guest Page", "blocked", true, "Public registration required but event is not published", ["Publish the event"], "Launch → click 'Publish event & go live'"),
  );

  // Registration (non-critical)
  const regOpen = event.publication?.registrationOpen ?? false;
  gates.push(
    !needsRegistration
      ? gate("registration", "Registration", "go", false, "Not applicable")
      : regOpen
        ? gate("registration", "Registration", "go", false, "Registration open")
        : gate("registration", "Registration", "warning", false, "Registration is not open"),
  );

  // Map (non-critical)
  const hasMap = publicEvent && event.publication?.publicMap && Object.keys(event.publication.publicMap as object).length > 0;
  gates.push(
    !needsRegistration
      ? gate("map", "Map", "go", false, "Not applicable")
      : hasMap
        ? gate("map", "Map", "go", false, "Guest map configured")
        : gate("map", "Map", "warning", false, "No guest map configured"),
  );

  // Safety (non-critical)
  const safetyConflict = openConflicts.some((c) => c.type === "POWER_CABLE_RISK" || c.type === "GUEST_FLOW_RISK");
  gates.push(
    safetyConflict
      ? gate("safety", "Safety", "warning", false, "Open safety-related risk")
      : gate("safety", "Safety", "go", false, "No outstanding safety risks"),
  );

  // Conflicts (critical)
  gates.push(
    criticalOpen.length > 0
      ? gate("conflicts", "Conflicts", "blocked", true, `${criticalOpen.length} critical conflict(s) open`, criticalOpen.map((c) => c.title), "Protect → apply the AI resolution for each blocked conflict")
      : openConflicts.length > 0
        ? gate("conflicts", "Conflicts", "warning", true, `${openConflicts.length} low/medium conflict(s) open`)
        : gate("conflicts", "Conflicts", "go", true, "No open conflicts"),
  );

  const overallStatus = worst(gates.map((g) => g.status));
  const criticalGates = gates.filter((g) => g.critical);
  const readyForLaunch = criticalGates.every((g) => g.status !== "blocked");

  const pathToGo = gates
    .filter((g) => g.status !== "go" && g.nextAction)
    .sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      if (a.status === "blocked" && b.status !== "blocked") return -1;
      if (a.status !== "blocked" && b.status === "blocked") return 1;
      return 0;
    })
    .map((g) => ({ gateKey: g.key, label: g.label, action: g.nextAction!, critical: g.critical }));

  return { eventId, overallStatus, readyForLaunch, gates, pathToGo };
}

function gate(
  key: string,
  label: string,
  status: GateStatus,
  critical: boolean,
  message: string,
  blockers: string[] = [],
  nextAction?: string,
): LaunchGate {
  return { key, label, status, critical, message, blockers, nextAction };
}
