"use client";

import { useState } from "react";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { PyramidTwin } from "@/components/manager/twin";
import { LIME } from "@/lib/manager/data";

const A = LIME;

export type SpaceRow = {
  id: string;
  name: string;
  capacity: number | null;
  reservationStatus: string;
  reservationEvent: string;
  reservationWhen: string;
  utilPct: number;
  twinSlug: string | null;
};

export type TwinRoomPosition = {
  slug: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
};

interface Props {
  spaces: SpaceRow[];
  rooms: TwinRoomPosition[];
}

export function SpacesClient({ spaces, rooms }: Props) {
  const { isMobile } = useMgrViewport();

  const defaultFocus =
    spaces.find((s) => s.twinSlug && s.reservationStatus === "Reserved")?.twinSlug ??
    spaces[0]?.twinSlug ??
    rooms[0]?.slug ??
    "";
  const [focusRoom, setFocusRoom] = useState(defaultFocus);

  const selected = spaces
    .filter((s) => s.twinSlug && s.reservationStatus === "Reserved")
    .map((s) => s.twinSlug!);

  const occ: Record<string, number> = {};
  spaces.forEach((s) => {
    if (s.twinSlug) occ[s.twinSlug] = s.utilPct;
  });

  const twinRooms = rooms.map((r) => ({
    id: r.slug,
    name: r.name,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  }));

  function roomColor(slug: string | null): string {
    if (!slug) return "#7D8799";
    return rooms.find((r) => r.slug === slug)?.color ?? "#7D8799";
  }

  const spacesCols = isMobile ? "1fr" : "1.15fr 0.85fr";

  return (
    <ScreenContainer>
      <div style={{ display: "grid", gridTemplateColumns: spacesCols, gap: 18, alignItems: "start" }}>
        {/* Twin panel */}
        <div
          style={{
            position: "relative",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 22,
            background: "radial-gradient(700px 460px at 50% 24%,rgba(200,240,0,.06),#0B0E13)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",
              backgroundSize: "34px 34px",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              padding: "8px 13px",
              borderRadius: 9,
              background: "rgba(13,13,18,.6)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div
              style={{
                font: "600 9px 'JetBrains Mono', monospace",
                color: "#7D8799",
                letterSpacing: ".1em",
              }}
            >
              PYRAMID TWIN
            </div>
            <div style={{ font: "700 12px Inter, sans-serif", color: "#fff", marginTop: 3 }}>
              Reservations · Live
            </div>
          </div>
          <div
            style={{
              height: "clamp(400px,46vh,520px)",
              padding: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PyramidTwin
              selected={selected}
              layer="occupancy"
              occ={occ}
              focus={focusRoom}
              onRoom={(id) => setFocusRoom(id)}
              rooms={twinRooms.length > 0 ? twinRooms : undefined}
            />
          </div>
        </div>

        {/* Space rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {spaces.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "#7D8799",
                font: "500 13px Inter, sans-serif",
                border: "1px solid rgba(255,255,255,.07)",
                borderRadius: 15,
                background: "#151821",
              }}
            >
              No spaces found — run <code>npm run db:seed</code> to populate demo data.
            </div>
          ) : (
            spaces.map((s) => {
              const free = s.reservationStatus === "Free";
              const isF = focusRoom === s.twinSlug;
              const color = roomColor(s.twinSlug);
              return (
                <button
                  key={s.id}
                  onClick={() => s.twinSlug && setFocusRoom(s.twinSlug)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    textAlign: "left",
                    padding: 16,
                    border: `1px solid ${isF ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.07)"}`,
                    borderRadius: 15,
                    background: free ? "rgba(21,24,33,.6)" : "#151821",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 34,
                      borderRadius: 5,
                      background: color,
                      flex: "none",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{s.name}</span>
                      <span
                        style={{
                          font: "700 8px 'JetBrains Mono', monospace",
                          letterSpacing: ".06em",
                          color: free ? "#22C55E" : A,
                          background: free ? "rgba(34,197,94,.14)" : "rgba(200,240,0,.12)",
                          padding: "4px 7px",
                          borderRadius: 6,
                        }}
                      >
                        {s.reservationStatus}
                      </span>
                    </div>
                    <div
                      style={{
                        font: "500 11px Inter, sans-serif",
                        color: "#7D8799",
                        marginTop: 4,
                      }}
                    >
                      {s.reservationEvent} ·{" "}
                      <span style={{ color: "#AEB5C2" }}>{s.reservationWhen}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    <div
                      style={{
                        font: "700 13px 'JetBrains Mono', monospace",
                        color: "#fff",
                      }}
                    >
                      {s.capacity != null ? String(s.capacity) : "—"}
                    </div>
                    <div
                      style={{
                        font: "600 8px 'JetBrains Mono', monospace",
                        color: "#7D8799",
                        letterSpacing: ".06em",
                        marginTop: 3,
                      }}
                    >
                      CAP · {s.utilPct}% USED
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </ScreenContainer>
  );
}
