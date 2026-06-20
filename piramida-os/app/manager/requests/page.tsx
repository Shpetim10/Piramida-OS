import Link from "next/link";
import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { listEventRequests } from "@/lib/services/event-requests";

const STATUS_COLOR: Record<string, string> = {
  RECEIVED: "#F59E0B",
  PARSED: "#2A6FDB",
  REVIEWED: "#C8F000",
  PLANNING: "#7A4BD6",
  PROPOSED: "#C0612A",
  APPROVED: "#22C55E",
  REJECTED: "#EF4444",
  CANCELLED: "#39414F",
};

export default async function Page() {
  let requests: Awaited<ReturnType<typeof listEventRequests>> = [];
  try {
    requests = await listEventRequests();
  } catch {
    // Not authenticated in demo — show empty
  }

  const pending = requests.filter((r) => ["RECEIVED", "PARSED"].includes(r.status));

  return (
    <ScreenContainer>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <p style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: 0, maxWidth: 480 }}>
          Organizer requests awaiting review. Open one to inspect AI-structured fields and generate an event.
        </p>
        <div style={{ display: "flex", gap: 18 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "800 22px/1 Inter, sans-serif", color: "#F59E0B" }}>{pending.length}</div>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>PENDING</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "800 22px/1 Inter, sans-serif", color: "#fff" }}>{requests.length}</div>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>TOTAL</div>
          </div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#7D8799", font: "500 14px Inter, sans-serif" }}>
          No requests found — run <code>npm run db:seed</code> to populate demo data.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map((r) => {
            const rc = r as typeof r & { contact?: { firstName: string; lastName: string } | null; client?: { name: string } | null };
            const initials = (rc.contact?.firstName?.[0] ?? "?") + (rc.contact?.lastName?.[0] ?? "?");
            const statusColor = STATUS_COLOR[r.status] ?? "#7D8799";
            const extractedGuests =
              r.extractedJson && typeof r.extractedJson === "object" && "expectedGuests" in (r.extractedJson as Record<string, unknown>)
                ? String((r.extractedJson as Record<string, unknown>).expectedGuests)
                : "—";
            return (
              <Link
                key={r.id}
                href={`/manager/requests/${r.id}`}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", textDecoration: "none" }}
              >
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#C53A6B,#1D2230)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px Inter, sans-serif", color: "#fff", flex: "none" }}>
                  {initials.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 14px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.title ?? "Untitled"} · {rc.client?.name ?? ""}
                  </div>
                  <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 3 }}>
                    SUBMITTED {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase()} · {(r.channel?.toUpperCase() ?? "PORTAL")}
                  </div>
                </div>
                <span
                  style={{
                    font: "600 10px 'JetBrains Mono', monospace",
                    letterSpacing: ".06em",
                    color: r.status === "RECEIVED" ? "#0D0D12" : "#fff",
                    background: r.status === "RECEIVED" ? "#C8F000" : statusColor + "30",
                    padding: "5px 9px",
                    borderRadius: 7,
                    flex: "none",
                  }}
                >
                  {r.status}
                </span>
                <div style={{ textAlign: "right", flex: "none", width: 56 }}>
                  <div style={{ font: "800 18px/1 Inter, sans-serif", color: "#fff" }}>{extractedGuests}</div>
                  <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginTop: 3 }}>GUESTS</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" stroke="#7D8799" strokeWidth="2" fill="none" strokeLinecap="round" style={{ flex: "none" }}><path d="M9 6l6 6-6 6" /></svg>
              </Link>
            );
          })}
        </div>
      )}
    </ScreenContainer>
  );
}
