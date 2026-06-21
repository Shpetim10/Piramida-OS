import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/guards";
import { ok, apiError, handleApiError } from "@/lib/api/respond";
import { generatePlanTasks } from "@/lib/planning/tasks";
import type { PlanWindow, RequirementMap, SelectedSpace } from "@/lib/planning/types";
import { enrichRunOfShowTasks } from "@/lib/ai/run-of-show";
import { enrichedToCard, sortEnriched } from "@/lib/manager/task-mapping";
import { ASSETS, ROOM_NAME } from "@/lib/data";

// Organizer plan confirmation -> run-of-show tasks.
//
// Derives the task list from the organizer's CHOICES (not hardcoded): the chosen
// schedule, attendees, assets, services, access flags and rooms become the
// inputs generatePlanTasks expects. The deterministic core is reused; Gemini
// then enriches it (adds event-type tasks + concise copy + role/priority). The
// response is board-ready cards for the manager Tasks board. This never throws
// in a way that should block confirmation — the client treats it as best-effort.

const daySchema = z.object({ date: z.string().default(""), type: z.enum(["half", "full"]).default("full") });

const bodySchema = z.object({
  eventType: z.string().trim().default("event"),
  attendees: z.number().int().positive().max(100000).default(0),
  schedule: z
    .object({
      startDate: z.string().default(""),
      endDate: z.string().default(""),
      days: z.array(daySchema).default([]),
    })
    .default({ startDate: "", endDate: "", days: [] }),
  assets: z.record(z.string(), z.number()).default({}),
  services: z.array(z.string()).default([]),
  rooms: z.array(z.string()).default([]),
  access: z
    .object({ externalGuests: z.boolean(), isPublic: z.boolean() })
    .default({ externalGuests: false, isPublic: false }),
});

type Body = z.infer<typeof bodySchema>;

const HOUR = 60 * 60_000;

// Build a plan window from the chosen schedule. Times are demo defaults (09:00
// start; 17:00 full / 13:00 half end) with setup/teardown buffers. If no date is
// set yet, anchor two weeks out so the tasks still carry sensible relative dates.
function buildWindow(schedule: Body["schedule"]): PlanWindow {
  const startIso = schedule.startDate || schedule.days.find((d) => d.date)?.date || "";
  const endIso = schedule.endDate || startIso;
  const lastType = schedule.days.length ? schedule.days[schedule.days.length - 1].type : "full";

  const eventStart = startIso ? new Date(`${startIso}T09:00:00`) : new Date();
  if (!startIso) {
    eventStart.setDate(eventStart.getDate() + 14);
    eventStart.setHours(9, 0, 0, 0);
  }
  const eventEnd = endIso ? new Date(`${endIso}T00:00:00`) : new Date(eventStart);
  eventEnd.setHours(lastType === "half" ? 13 : 17, 0, 0, 0);

  const setupStart = new Date(eventStart.getTime() - 2 * HOUR);
  const teardownEnd = new Date(eventEnd.getTime() + 2 * HOUR);
  return {
    setupStart,
    eventStart,
    eventEnd,
    teardownEnd,
    availabilityUntil: new Date(teardownEnd.getTime() + 2 * HOUR),
  };
}

// Minimal SelectedSpace objects — generatePlanTasks only reads name, spaceId and
// roleKey (to locate the registration space). Cast keeps us from fabricating the
// full scoring shape the planner doesn't need here.
function buildSpaces(rooms: string[], hasRegistration: boolean): SelectedSpace[] {
  return rooms.map((id, i) => {
    let roleKey: SelectedSpace["roleKey"] = i === 0 ? "keynote" : "breakout";
    if (hasRegistration && i === rooms.length - 1 && rooms.length > 1) roleKey = "coffeeRegistration";
    return {
      spaceId: id,
      name: ROOM_NAME[id] ?? id,
      roleKey,
      roleIndex: i,
    } as unknown as SelectedSpace;
  });
}

function titleCase(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.toLowerCase() === "event") return "New Event";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function scheduleSummary(schedule: Body["schedule"]): string {
  const dates = schedule.days.map((d) => d.date).filter(Boolean);
  if (!dates.length) return "date to be confirmed";
  const days = schedule.days.length;
  const allFull = schedule.days.every((d) => d.type === "full");
  return `${days} day${days > 1 ? "s" : ""} (${allFull ? "full" : "mixed half/full"}), ${dates[0]}${dates.length > 1 ? ` → ${dates[dates.length - 1]}` : ""}`;
}

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return apiError("Authentication required", 401);

    const body = bodySchema.parse(await req.json());

    const hasRegistration = body.services.includes("registration");
    const hasCatering = body.services.includes("catering");
    const window = buildWindow(body.schedule);
    const eventName = titleCase(body.eventType);

    const requirements: RequirementMap = {
      ...body.assets,
      registrationDesk: hasRegistration,
      publicGuestRegistration: body.access.isPublic || body.access.externalGuests,
      coffeeArea: hasCatering,
    };

    const event = {
      id: "organizer-plan",
      title: eventName,
      type: body.eventType,
      expectedGuests: body.attendees,
      window,
    };
    const selectedSpaces = buildSpaces(body.rooms, hasRegistration);

    // Deterministic core, then Gemini enrichment (best-effort; falls back to the
    // deterministic tasks alone on any failure or missing key).
    const baseTasks = generatePlanTasks({ event, requirements, selectedSpaces });
    const { tasks, model } = await enrichRunOfShowTasks({
      plan: {
        eventName,
        eventType: body.eventType,
        attendees: body.attendees,
        scheduleSummary: scheduleSummary(body.schedule),
        rooms: body.rooms.map((id) => ROOM_NAME[id] ?? id),
        assets: ASSETS.flatMap((a) => {
          const qty = body.assets[a.id] ?? 0;
          return qty > 0 ? [{ label: a.label, qty }] : [];
        }),
        services: body.services,
        access: body.access,
      },
      baseTasks,
    });

    const cards = sortEnriched(tasks).map((task) => enrichedToCard(task, { eventName, window }));

    return ok({ tasks: cards, count: cards.length, model });
  } catch (err) {
    return handleApiError(err);
  }
}
