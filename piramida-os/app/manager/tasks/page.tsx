"use client";

import { useState } from "react";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { TASKS, TASK_ROLES, AVATAR_COLOR, TASK_COLUMNS, LIME } from "@/lib/manager/data";

const A = LIME;

export default function ManagerTasksPage() {
  const { isMobile, isNarrow } = useMgrViewport();
  const [taskRole, setTaskRole] = useState("all");

  const taskCols = isNarrow ? "1fr" : isMobile ? "1fr 1fr" : "repeat(4,1fr)";
  const tkFiltered = taskRole === "all" ? TASKS : TASKS.filter((t) => t.role === taskRole);

  return (
    <ScreenContainer>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginRight: 4 }}>FILTER</span>
        {TASK_ROLES.map((r) => {
          const active = taskRole === r;
          return (
            <button
              key={r}
              onClick={() => setTaskRole(r)}
              style={{
                padding: "8px 14px",
                borderRadius: 100,
                border: `1px solid ${active ? A : "rgba(255,255,255,.12)"}`,
                background: active ? A : "transparent",
                color: active ? "#0D0D12" : "#AEB5C2",
                font: "600 12px Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              {r === "all" ? "All roles" : r}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: taskCols, gap: 14, alignItems: "start" }}>
        {TASK_COLUMNS.map((col) => {
          const ts = tkFiltered.filter((t) => t.st === col.id);
          return (
            <div key={col.id} style={{ background: "#0F1218", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                <span style={{ font: "700 12px Inter, sans-serif", color: "#fff" }}>{col.label}</span>
                <span style={{ marginLeft: "auto", font: "700 11px 'JetBrains Mono', monospace", color: "#7D8799" }}>{ts.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ts.map((t, i) => (
                  <div key={i} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, background: "#151821", padding: 13, borderLeft: `3px solid ${col.color}` }}>
                    <div style={{ font: "600 13px/1.35 Inter, sans-serif", color: "#fff", marginBottom: 9 }}>{t.t}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", background: "#0F1218", border: "1px solid rgba(255,255,255,.07)", padding: "4px 7px", borderRadius: 6 }}>{t.ev}</span>
                      <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#AEB5C2" }}>{t.role}</span>
                      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799" }}>{t.due}</span>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            font: "700 9px Inter, sans-serif",
                            color: t.who === "EK" ? "#0D0D12" : "#fff",
                            background: AVATAR_COLOR[t.who],
                            flex: "none",
                          }}
                        >
                          {t.who}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScreenContainer>
  );
}
