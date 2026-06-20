import { getLaunchReadiness } from "@/lib/services/launch-readiness";
import { getSetting } from "@/lib/services/settings";
import { LaunchClient } from "./LaunchClient";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const [readiness, gateNotes] = await Promise.all([
    getLaunchReadiness(eventId).catch(() => null),
    getSetting<Record<string, string>>("launch.gate_notes").catch(() => null),
  ]);

  if (!readiness) {
    return (
      <div style={{ padding: 32, color: "#EF4444", font: "500 14px Inter, sans-serif" }}>
        Event not found or planning not yet run. Generate a plan first.
      </div>
    );
  }

  return (
    <LaunchClient
      eventId={eventId}
      readiness={readiness}
      gateNotes={gateNotes ?? {}}
    />
  );
}
