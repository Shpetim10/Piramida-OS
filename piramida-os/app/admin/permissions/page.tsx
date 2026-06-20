"use client";

import { AdminScreen } from "@/components/admin/AdminScreen";
import { AdminIcon } from "@/components/admin/AdminShell";
import { ROLE_DEFINITIONS } from "@/lib/admin/data";

export default function PermissionsPage() {
  return (
    <AdminScreen>
      <p style={{ font: "400 14px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 22px", maxWidth: 560 }}>
        A plain-language overview of what each role can do inside Pyramid OS. No matrices — every role maps to a clear operational scope.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
        {ROLE_DEFINITIONS.map((r) => (
          <div key={r.role} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, background: "#151821", padding: 20, borderTop: `2px solid ${r.c}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: 4, background: r.c, flex: "none", boxShadow: `0 0 8px ${r.c}66` }} />
              <span style={{ font: "700 15px Inter, sans-serif", color: "#fff", flex: 1 }}>{r.role}</span>
              <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799" }}>{r.caps.length} CAPS</span>
            </div>
            <p style={{ font: "500 12px/1.4 Inter, sans-serif", color: "#7D8799", margin: "0 0 16px", paddingLeft: 22 }}>{r.scope}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {r.caps.map(([cap, on]) => (
                <div key={cap} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: on ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.12)" }}>
                    <AdminIcon name={on ? "check" : "x"} color={on ? "#22C55E" : "#EF4444"} />
                  </span>
                  <span style={{ font: "500 12px Inter, sans-serif", color: on ? "#E6E9EF" : "#525B6B" }}>{cap}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminScreen>
  );
}
