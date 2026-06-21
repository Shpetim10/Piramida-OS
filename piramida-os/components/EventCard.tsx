import Link from "next/link";
import { EVENT_COLORS, type PyramidEvent } from "@/lib/data";

type Variant = "live" | "upcoming" | "pastPreview" | "pastFull";

const cardStyle: React.CSSProperties = {
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 18,
  overflow: "hidden",
  background: "#151821",
  display: "block",
  textDecoration: "none",
};

const hatch: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 13px)",
};

const hatchDim: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 2px,transparent 2px 13px)",
};

function poster(color: string, dim: boolean): React.CSSProperties {
  return {
    position: "relative",
    height: dim ? 130 : 150,
    background: dim
      ? `linear-gradient(135deg,${color}22,#151821 70%)`
      : `linear-gradient(135deg,${color}33,#151821 70%)`,
    overflow: "hidden",
    ...(dim ? { filter: "saturate(.7)" } : {}),
  };
}

export function EventCard({
  event,
  variant,
}: {
  event: PyramidEvent;
  variant: Variant;
}) {
  const color = EVENT_COLORS[event.type] ?? "#333";
  const dim = variant === "pastPreview" || variant === "pastFull";

  return (
    <Link href={`/events/${event.id}`} style={cardStyle}>
      <div style={poster(color, dim)}>
        <div style={dim ? hatchDim : hatch} />

        {variant === "live" && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 11px",
              borderRadius: 8,
              background: "rgba(239,68,68,.85)",
            }}
          >
            <span
              style={{
                font: "600 10px/1 'JetBrains Mono', monospace",
                color: "#fff",
                letterSpacing: ".12em",
              }}
            >
              LIVE NOW
            </span>
          </div>
        )}

        {variant === "upcoming" && (
          <>
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 11px",
                borderRadius: 8,
                background: "rgba(13,13,18,.6)",
                backdropFilter: "blur(6px)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: color,
                }}
              />
              <span
                style={{
                  font: "600 10px/1 'JetBrains Mono', monospace",
                  color: "#fff",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                {event.type}
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 14,
                padding: "9px 12px",
                borderRadius: 10,
                background: "rgba(13,13,18,.62)",
                backdropFilter: "blur(6px)",
                textAlign: "center",
              }}
            >
              <div style={{ font: "800 20px/1 Inter, sans-serif", color: "#fff" }}>
                {event.day}
              </div>
              <div
                style={{
                  font: "600 10px/1 'JetBrains Mono', monospace",
                  color: "#AEB5C2",
                  marginTop: 3,
                  letterSpacing: ".1em",
                }}
              >
                {event.month}
              </div>
            </div>
          </>
        )}

        {variant === "pastPreview" && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              padding: "6px 11px",
              borderRadius: 8,
              background: "rgba(13,13,18,.6)",
              font: "600 10px/1 'JetBrains Mono', monospace",
              color: "#7D8799",
              letterSpacing: ".12em",
            }}
          >
            {event.month} · PAST
          </div>
        )}

        {variant === "pastFull" && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              padding: "6px 11px",
              borderRadius: 8,
              background: "rgba(13,13,18,.6)",
              font: "600 10px/1 'JetBrains Mono', monospace",
              color: "#7D8799",
              letterSpacing: ".12em",
            }}
          >
            {event.day} {event.month} · COMPLETED
          </div>
        )}
      </div>

      <div style={{ padding: 18 }}>
        <div
          style={{
            font: `700 ${variant === "pastPreview" ? 16 : 17}px/1.25 Inter, sans-serif`,
            color: "#fff",
            marginBottom: variant === "pastFull" ? 12 : 10,
          }}
        >
          {event.title}
        </div>

        {variant === "live" && (
          <div style={footerRow}>
            <span>{event.room}</span>
            <span>{event.guests} attending</span>
          </div>
        )}

        {variant === "upcoming" && (
          <div style={footerRow}>
            <span>{event.room}</span>
            <span>{event.guests} guests</span>
          </div>
        )}

        {variant === "pastPreview" && (
          <div style={footerRow}>
            <span style={{ color: "#22C55E" }}>{event.attendance} attended</span>
          </div>
        )}

        {variant === "pastFull" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799" }}>
                Attendance
              </div>
              <div
                style={{
                  font: "700 15px 'JetBrains Mono', monospace",
                  color: "#22C55E",
                  marginTop: 3,
                }}
              >
                {event.attendance} / {event.guests}
              </div>
            </div>
            <span style={{ font: "500 11px Inter, sans-serif", color: "#7D8799" }}>
              {event.room}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

const footerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  font: "500 12px Inter, sans-serif",
  color: "#7D8799",
};
