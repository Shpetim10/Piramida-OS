import type { DnaScore, PlanningConfig, RequirementMap } from "./types";

function num(reqs: RequirementMap, key: string): number {
  const value = reqs[key];
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

export function computeEventDna(requirements: RequirementMap, config: PlanningConfig): DnaScore[] {
  const dimensions = config.dnaDimensions.length >= 5 ? config.dnaDimensions : [
    { key: "peopleIntensity", label: "People Intensity", shortLabel: "PEOPLE", formula: "guestDensity" },
    { key: "technicalComplexity", label: "Technical Complexity", shortLabel: "TECH", formula: "techCount" },
    { key: "spaceComplexity", label: "Space Complexity", shortLabel: "SPACE", formula: "spaceCount" },
    { key: "assetIntensity", label: "Asset Intensity", shortLabel: "ASSETS", formula: "assetCount" },
    { key: "guestJourney", label: "Guest Journey", shortLabel: "JOURNEY", formula: "registration" },
  ];

  return dimensions.map((dimension) => ({
    key: dimension.key,
    label: dimension.label,
    shortLabel: dimension.shortLabel,
    value: scoreFormula(dimension.formula, requirements),
  }));
}

function scoreFormula(formula: string, reqs: RequirementMap): number {
  switch (formula) {
    case "guestDensity": {
      const guests = num(reqs, "expectedGuests");
      if (guests >= 300) return 95;
      if (guests >= 200) return 85;
      if (guests >= 150) return 75;
      if (guests >= 100) return 60;
      return Math.round((guests / 300) * 60);
    }
    case "techCount": {
      const total = ["wirelessMicrophones", "wiredMicrophones", "projectors", "screens", "speakers"].reduce((sum, key) => sum + num(reqs, key), 0);
      return Math.min(100, total * 6);
    }
    case "spaceCount": {
      const total = num(reqs, "breakoutRooms") + (reqs.mainStage ? 1 : 0) + (reqs.coffeeArea ? 1 : 0) + (reqs.registrationDesk ? 1 : 0);
      return Math.min(100, total * 20);
    }
    case "assetCount": {
      const tech = ["wirelessMicrophones", "wiredMicrophones", "projectors", "screens", "speakers"].reduce((sum, key) => sum + num(reqs, key), 0);
      const furniture = Math.ceil((num(reqs, "chairs") + num(reqs, "tables")) / 20);
      return Math.min(100, tech * 8 + furniture);
    }
    case "registration":
      return reqs.publicGuestRegistration ? 85 : reqs.registrationDesk ? 65 : 30;
    case "setupHours":
      return Math.min(100, num(reqs, "setupHours") * 20);
    case "breakout":
      return num(reqs, "breakoutRooms") >= 2 ? 85 : num(reqs, "breakoutRooms") === 1 ? 65 : 35;
    case "livestream":
      return reqs.livestream ? 76 : 28;
    default:
      return 50;
  }
}
