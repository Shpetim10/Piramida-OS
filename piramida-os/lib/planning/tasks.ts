import type { GeneratedTask, PlanningEvent, RequirementMap, SelectedSpace } from "./types";

export function generatePlanTasks(input: {
  event: PlanningEvent;
  requirements: RequirementMap;
  selectedSpaces: SelectedSpace[];
}): GeneratedTask[] {
  const setupDue = new Date(input.event.window.setupStart.getTime() - 30 * 60_000);
  const avDue = new Date(input.event.window.eventStart.getTime() - 60 * 60_000);
  const teardownDue = new Date(input.event.window.teardownEnd.getTime());
  const tasks: GeneratedTask[] = [
    {
      title: "Setup rooms from generated plan",
      description: `Prepare ${input.selectedSpaces.map((space) => space.name).join(", ")} for ${input.event.expectedGuests} guests.`,
      priority: "HIGH",
      dueAt: setupDue,
      source: "planning-engine",
    },
    {
      title: "Teardown and return spaces",
      description: "Strike furniture, remove signage, and return spaces to normal configuration.",
      priority: "MEDIUM",
      dueAt: teardownDue,
      source: "planning-engine",
      dependsOnTitle: "Setup rooms from generated plan",
    },
  ];

  if (Number(input.requirements.wirelessMicrophones ?? 0) + Number(input.requirements.projectors ?? 0) + Number(input.requirements.screens ?? 0) > 0) {
    tasks.push({
      title: "AV install and sound check",
      description: "Install microphones, screens, projectors, speakers, and cable kit from the dry-run asset plan.",
      priority: "HIGH",
      dueAt: avDue,
      source: "planning-engine",
      dependsOnTitle: "Setup rooms from generated plan",
    });
  }

  if (input.requirements.registrationDesk || input.requirements.publicGuestRegistration) {
    tasks.push({
      title: "Registration desk and QR check-in",
      description: "Prepare arrival desk, QR scanning position, and guest flow signage at the entrance.",
      priority: "MEDIUM",
      dueAt: new Date(input.event.window.eventStart.getTime() - 45 * 60_000),
      source: "planning-engine",
      spaceId: input.selectedSpaces.find((space) => space.roleKey === "coffeeRegistration")?.spaceId,
      dependsOnTitle: "Setup rooms from generated plan",
    });
  }

  return tasks;
}
