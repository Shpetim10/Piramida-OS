"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useViewport } from "@/lib/useViewport";
import { ADMIN_LABELS } from "@/lib/admin/data";

const A = "#D6FF00";

// Admin Control Center icon set (distinct from the Manager set).
export function AdminIcon({ name, color = "currentColor" }: { name: string; color?: string }) {
  const P: Record<string, string> = {
    approvals: "M9 12l2 2 4-4M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6z",
    staff: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 4a3 3 0 010 6M18 20c0-2.6-1-4-3-4.6",
    permissions: "M7 11V8a5 5 0 0110 0v3M5 11h14v9H5zM12 15v2",
    check: "M4 12l5 5L20 6",
    x: "M6 6l12 12M18 6L6 18",
  };
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name] || ""} />
    </svg>
  );
}

function resolveScreen(pathname: string): string {
  if (pathname.startsWith("/admin/organizer-approvals")) return "approvals";
  if (pathname === "/admin/users/new") return "staff-new";
  if (pathname.startsWith("/admin/users/") && pathname !== "/admin/users") return "staff-edit";
  if (pathname.startsWith("/admin/users")) return "staff";
  if (pathname.startsWith("/admin/permissions")) return "permissions";
  return "approvals";
}

type NavItem = { id: string; label: string; icon: string; href: string; badge?: string };

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { vw } = useViewport();
  const isMobile = vw < 980;
  const isNarrow = vw < 720;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const screen = resolveScreen(pathname);
  // Staff sub-screens (new / edit) keep the "Staff Management" nav item active.
  const navActive = screen === "staff-new" || screen === "staff-edit" ? "staff" : screen;
  const [kicker, label] = ADMIN_LABELS[screen] || ["", ""];

  const nav: NavItem[] = [
    { id: "approvals", label: "Organizer Approvals", icon: "approvals", href: "/admin/organizer-approvals", badge: "3" },
    { id: "staff", label: "Staff Management", icon: "staff", href: "/admin/users" },
    { id: "permissions", label: "Permissions", icon: "permissions", href: "/admin/permissions" },
  ];

  const asideStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
        width: 266,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        padding: "22px 16px",
        background: "#121620",
        borderRight: "1px solid rgba(255,255,255,.07)",
        transform: sidebarOpen ? "translateX(0)" : "translateX(-110%)",
        transition: "transform .3s cubic-bezier(.2,.8,.2,1)",
        boxShadow: "24px 0 60px rgba(0,0,0,.5)",
      }
    : {
        position: "sticky",
        top: 0,
        height: "100vh",
        width: 262,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        padding: "22px 16px",
        background: "#121620",
        borderRight: "1px solid rgba(255,255,255,.07)",
      };

  return (
    <div style={{ display: "flex", flexDirection: "row", minHeight: "100vh", background: "#0D0D12", position: "relative", fontFamily: "Inter, sans-serif" }}>
      {isMobile && sidebarOpen ? (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)" }} />
      ) : null}

      <aside style={asideStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 4px 22px" }}>
          <svg width="32" height="32" viewBox="0 0 34 34" fill="none">
            <polygon points="17,4 31,29 3,29" stroke="#D6FF00" strokeWidth="1.6" />
            <polygon points="17,4 24,16.5 10,16.5" fill="#D6FF00" opacity="0.9" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "800 16px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>Pyramid OS</div>
            <div style={{ font: "600 9px/1.4 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".2em", marginTop: 4 }}>CONTROL&nbsp;CENTER</div>
          </div>
        </div>

        <div style={{ font: "600 9px/1 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".22em", padding: "8px 11px" }}>ADMINISTRATION</div>
        {nav.map((it) => {
          const active = navActive === it.id;
          return (
            <Link
              key={it.id}
              href={it.href}
              onClick={() => setSidebarOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                padding: "11px 11px",
                marginBottom: 3,
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                font: "600 13.5px Inter, sans-serif",
                color: active ? "#fff" : "#AEB5C2",
                background: active ? "rgba(214,255,0,.07)" : "transparent",
                boxShadow: active ? `inset 2px 0 0 ${A}` : "none",
                textDecoration: "none",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, flex: "none" }}>
                <AdminIcon name={it.icon} color={active ? A : "#7D8799"} />
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
              {it.badge ? (
                <span style={{ font: "700 10px Inter, sans-serif", color: "#0D0D12", background: A, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12, paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, background: "#0F1218" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E", flex: "none" }} />
            <div style={{ font: "600 10px/1.3 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".06em" }}>
              SINGLE TENANT
              <br />
              <span style={{ color: "#AEB5C2" }}>Pyramid of Tirana</span>
            </div>
          </div>
          <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#EF4444,#1D2230)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px Inter, sans-serif", color: "#fff", flex: "none" }}>
              BA
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "600 12px/1.2 Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Besnik Aliu</div>
              <div style={{ font: "500 10px/1.3 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", maxHeight: "100vh" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: 14, height: 62, padding: "0 24px", background: "rgba(13,13,18,.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,.07)", flex: "none" }}>
          <button onClick={() => setSidebarOpen((v) => !v)} style={{ display: isMobile ? "flex" : "none", width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,.1)", background: "#1D2230", color: "#fff", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "600 9px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".2em" }}>ADMIN · {kicker}</div>
            <div style={{ font: "800 16px/1.2 Inter, sans-serif", color: "#fff", letterSpacing: "-.01em", marginTop: 4 }}>{label}</div>
          </div>
          <div style={{ marginLeft: "auto", font: "600 11px/1 'JetBrains Mono', monospace", color: "#AEB5C2", letterSpacing: ".06em", display: isNarrow ? "none" : "block" }}>20 JUN 2026</div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>{children}</main>
      </div>
    </div>
  );
}
