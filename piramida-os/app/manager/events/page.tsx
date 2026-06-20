"use client";

import Link from "next/link";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { EVENTS_LIST, STAGE_COLOR, LIME } from "@/lib/manager/data";

export default function ManagerEventsPage() {
  const { isMobile, isNarrow } = useMgrViewport();

  const evCols = isNarrow
    ? "1.6fr 1fr 0.7fr"
    : isMobile
    ? "1.6fr 1fr 1fr"
    : "2fr 1fr 0.7fr 1fr 1fr 1fr";
  const evHideCol = isMobile ? { display: "none" as const } : {};

  return (
    <ScreenContainer>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <p style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: 0, maxWidth: 480 }}>
          Every event in the Pyramid, with its current position in the operational pipeline and live readiness.
        </p>
        <div style={{ display: "flex", gap: 18 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "800 22px/1 Inter, sans-serif", color: "#fff" }}>5</div>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>TOTAL</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "800 22px/1 Inter, sans-serif", color: LIME }}>3</div>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>IN PIPELINE</div>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", overflow: "hidden" }}>
        {/* Column header row */}
        <div style={{ display: "grid", gridTemplateColumns: evCols, gap: 12, padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>
          <div>EVENT</div>
          <div style={evHideCol}>DATE</div>
          <div style={evHideCol}>GUESTS</div>
          <div style={evHideCol}>SPACES</div>
          <div>PIPELINE STAGE</div>
          <div style={{ textAlign: "right" }}>READINESS</div>
        </div>

        {/* Rows */}
        {EVENTS_LIST.map((e) => {
          const isCompleted = e.stage === "Completed";
          const stageBg = isCompleted ? "#1A1F2B" : STAGE_COLOR[e.stage];
          const stageColor = isCompleted ? "#7D8799" : "#0D0D12";
          return (
            <Link
              key={e.id}
              href={`/manager/events/${e.id}/understand`}
              style={{ display: "grid", gridTemplateColumns: evCols, gap: 12, alignItems: "center", padding: "15px 20px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: e.tc, flex: "none" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                  <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>{e.type}</div>
                </div>
              </div>
              <div style={{ ...evHideCol, font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>{e.date}</div>
              <div style={{ ...evHideCol, font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>{e.guests}</div>
              <div style={{ ...evHideCol, font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>{e.rooms}</div>
              <div>
                <span style={{ display: "inline-block", font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: stageColor, background: stageBg, padding: "5px 9px", borderRadius: 7 }}>{e.stage}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: "flex-end" }}>
                <div style={{ width: 64, height: 5, borderRadius: 3, background: "#0F1218", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${e.ready}%`, background: STAGE_COLOR[e.stage], borderRadius: 3 }} />
                </div>
                <span style={{ font: "700 12px 'JetBrains Mono', monospace", color: "#fff", width: 34, textAlign: "right" }}>{e.ready}%</span>
              </div>
            </Link>
          );
        })}
      </div>
    </ScreenContainer>
  );
}
