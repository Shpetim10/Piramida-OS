import Link from "next/link";
import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { getEventRequest } from "@/lib/services/event-requests";
import { notFound } from "next/navigation";

const LIME = "#C8F000";

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;

  let request: Awaited<ReturnType<typeof getEventRequest>>;
  try {
    request = await getEventRequest(requestId);
  } catch {
    notFound();
  }

  if (!request) notFound();

  const extracted = request.extractedJson as Record<string, unknown> | null;
  const missingFields = (request.missingFields as string[] | null) ?? [];
  const confidence = request.confidence != null ? Math.round(request.confidence * 100) : null;

  const extractedFields = extracted
    ? [
        { k: "EVENT TYPE", v: String(extracted.eventType ?? "—") },
        { k: "ATTENDEES", v: String(extracted.expectedGuests ?? "—") },
        { k: "SETUP HOURS", v: extracted.setupHours != null ? `${extracted.setupHours}h` : "—" },
        { k: "BREAKOUT ROOMS", v: String(extracted.breakoutRooms ?? "—") },
        { k: "WIRELESS MICS", v: String(extracted.wirelessMicrophones ?? "—") },
        { k: "SCREENS", v: String(extracted.screens ?? "—") },
      ]
    : [];

  const chips: string[] = [];
  if (extracted) {
    if (extracted.mainStage) chips.push("Keynote stage");
    if (extracted.breakoutRooms) chips.push(`${extracted.breakoutRooms} breakout rooms`);
    if (extracted.coffeeArea) chips.push("Coffee area");
    if (extracted.registrationDesk) chips.push("Registration desk");
    if (extracted.publicGuestRegistration) chips.push("QR registration");
    if (extracted.wirelessMicrophones) chips.push(`${extracted.wirelessMicrophones}× wireless mics`);
    if (extracted.projectors) chips.push(`${extracted.projectors}× projector`);
    if (extracted.screens) chips.push(`${extracted.screens}× screen`);
    if (extracted.speakers) chips.push(`${extracted.speakers}× speakers`);
    if (extracted.chairs) chips.push(`${extracted.chairs} chairs`);
    if (extracted.tables) chips.push(`${extracted.tables} tables`);
    if (extracted.livestream) chips.push("Livestream");
  }

  const contactName = request.contact
    ? `${request.contact.firstName} ${request.contact.lastName}`
    : "Unknown";
  const clientName = request.client?.name ?? "Unknown";

  return (
    <ScreenContainer>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 18, alignItems: "start" }}>
        {/* Left — raw request */}
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#C53A6B,#1D2230)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px Inter, sans-serif", color: "#fff", flex: "none" }}>
              {contactName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>{contactName} · {clientName}</div>
              <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>
                SUBMITTED {new Date(request.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase()} · {request.channel?.toUpperCase() ?? "PORTAL"}
              </div>
            </div>
            <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#0D0D12", background: LIME, padding: "5px 9px", borderRadius: 7 }}>
              {request.status}
            </span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 10 }}>
              ORGANIZER&apos;S WORDS
            </div>
            <p style={{ font: "400 15px/1.7 Inter, sans-serif", color: "#E6E9EF", margin: 0, textWrap: "pretty" }}>
              &ldquo;{request.rawText}&rdquo;
            </p>
          </div>
        </div>

        {/* Right — AI understanding */}
        <div style={{ border: "1px solid rgba(200,240,0,.22)", borderRadius: 18, background: "radial-gradient(560px 320px at 80% 0%,rgba(200,240,0,.06),#151821)", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(200,240,0,.12)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" stroke={LIME} strokeWidth="1.7" fill="none" strokeLinecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>AI Structured Understanding</div>
              <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>PARSED FROM RAW REQUEST</div>
            </div>
            {confidence != null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ font: "800 18px/1 Inter, sans-serif", color: LIME }}>{confidence}%</div>
                <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>CONFIDENCE</div>
              </div>
            )}
          </div>

          <div style={{ padding: 20 }}>
            {extractedFields.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {extractedFields.map((f) => (
                    <div key={f.k} style={{ padding: 13, border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
                      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 6 }}>{f.k}</div>
                      <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{f.v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 9 }}>
                  DETECTED REQUIREMENTS
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
                  {chips.map((c) => (
                    <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, background: "rgba(200,240,0,.07)", border: "1px solid rgba(200,240,0,.18)", font: "600 11px Inter, sans-serif", color: "#E6E9EF" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: LIME }} />
                      {c}
                    </span>
                  ))}
                </div>
              </>
            )}

            {missingFields.length > 0 && (
              <div style={{ padding: 14, border: "1px solid rgba(245,158,11,.3)", borderRadius: 12, background: "rgba(245,158,11,.05)", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M12 8v5M12 17v.5" /><circle cx="12" cy="12" r="9" /></svg>
                  <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#F59E0B", letterSpacing: ".1em" }}>MISSING INFORMATION</span>
                </div>
                {missingFields.map((m) => (
                  <div key={m} style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>• {m}</div>
                ))}
              </div>
            )}

            {request.event ? (
              <Link
                href={`/manager/events/${request.event.id}/understand`}
                style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 15, borderRadius: 12, background: "#22C55E", color: "#0D0D12", font: "700 14px Inter, sans-serif", textDecoration: "none", boxSizing: "border-box" }}
              >
                Open Event →
              </Link>
            ) : (
              <CreateEventButton requestId={request.id} />
            )}
          </div>
        </div>
      </div>
    </ScreenContainer>
  );
}

function CreateEventButton({ requestId }: { requestId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { createEventFromRequest } = await import("@/lib/services/event-requests");
        const { redirect } = await import("next/navigation");
        const event = await createEventFromRequest(requestId);
        redirect(`/manager/events/${event.id}/understand`);
      }}
    >
      <button
        type="submit"
        style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 15, border: "none", borderRadius: 12, background: "#C8F000", color: "#0D0D12", font: "700 14px Inter, sans-serif", cursor: "pointer", boxShadow: "0 8px 26px rgba(200,240,0,.22)", boxSizing: "border-box" }}
      >
        Generate Event &amp; Build Plan
      </button>
    </form>
  );
}
