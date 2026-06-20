import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { EVENT_TYPE_OPTIONS, INTAKE_NEED_FIELDS, normalizeIntake } from "@/lib/ai/event-intake-contract";
import { getEventRequest } from "@/lib/services/event-requests";
import { REQUEST_RAW } from "@/lib/manager/data";
import { EventIntakePanel } from "./EventIntakePanel";

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const request = await getEventRequest(requestId).catch(() => null);
  const initialIntake = request?.extractedJson ? safeIntake(request.extractedJson) : null;

  const summary = request
    ? {
        id: request.id,
        title: request.title ?? "Untitled request",
        rawText: request.rawText,
        organizer: `${request.contact.firstName} ${request.contact.lastName}`,
        company: request.client.name,
        submitted: `SUBMITTED ${request.createdAt.toLocaleDateString("en-GB", { timeZone: "Europe/Tirane", day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}`,
        canCreateDraft: true,
        existingEventId: request.event?.id,
      }
    : {
        id: requestId,
        title: "Demo request",
        rawText: REQUEST_RAW.replace(/^"|"$/g, ""),
        organizer: "Sara Kelmendi",
        company: "Lumen Labs",
        submitted: "DEMO REQUEST",
        canCreateDraft: false,
        existingEventId: undefined,
      };

  return (
    <ScreenContainer>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 7 }}>UNDERSTAND</div>
          <h1 style={{ font: "800 24px/1.15 Inter, sans-serif", color: "#fff", margin: 0 }}>{summary.title}</h1>
        </div>
        {!request && (
          <div style={{ color: "#F59E0B", font: "600 12px/1.45 Inter, sans-serif", maxWidth: 360, textAlign: "right" }}>
            Demo-only request: parsing works, but creating a draft event requires opening a saved request.
          </div>
        )}
      </div>
      <EventIntakePanel
        request={summary}
        initialIntake={initialIntake}
        eventTypes={EVENT_TYPE_OPTIONS.map((type) => ({ id: type.id, label: type.label }))}
        needFields={INTAKE_NEED_FIELDS.map((field) => ({ ...field }))}
      />
    </ScreenContainer>
  );
}

function safeIntake(value: unknown) {
  try {
    return normalizeIntake(value);
  } catch {
    return null;
  }
}
