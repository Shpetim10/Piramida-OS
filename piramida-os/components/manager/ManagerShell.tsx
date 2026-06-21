"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useViewport } from "@/lib/useViewport";
import { MgrIcon } from "@/components/manager/twin";
import { FOCUS_EVENT_NAME, SCREEN_LABELS } from "@/lib/manager/data";
import { logoutAction } from "@/lib/auth/logout";
import { BrandMark } from "@/components/BrandLogo";

const A = "#C8F000";

// Map the current pathname to a screen key + the event id in scope (if any).
// eventId is only set when the URL contains a real event UUID segment.
function resolve(pathname: string): { screen: string; eventId: string | null } {
  const eventMatch = pathname.match(/^\/manager\/events\/([^/]+)\/([^/]+)/);
  if (eventMatch) return { screen: eventMatch[2], eventId: eventMatch[1] };
  if (pathname.startsWith("/manager/events")) return { screen: "events", eventId: null };
  if (pathname.startsWith("/manager/requests")) return { screen: "requests", eventId: null };
  if (pathname.startsWith("/manager/tasks")) return { screen: "tasks", eventId: null };
  if (pathname.startsWith("/manager/spaces")) return { screen: "spaces", eventId: null };
  if (pathname.startsWith("/manager/inventory")) return { screen: "inventory", eventId: null };
  return { screen: "dashboard", eventId: null };
}

type NavItem = { id: string; label: string; icon?: string; href: string; badge?: string; step?: string };

export function ManagerShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser?: { name: string; initials: string; title: string };
}) {
  const pathname = usePathname();
  const { vw } = useViewport();
  const isMobile = vw < 980;
  const isNarrow = vw < 720;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { screen } = resolve(pathname);

  const monitor: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard", href: "/manager" },
    { id: "requests", label: "Requests", icon: "requests", href: "/manager/requests", badge: "2" },
    { id: "events", label: "Events", icon: "events", href: "/manager/events" },
  ];
  const ops: NavItem[] = [
    { id: "tasks", label: "Tasks", icon: "tasks", href: "/manager/tasks" },
    { id: "spaces", label: "Spaces", icon: "spaces", href: "/manager/spaces" },
    { id: "inventory", label: "Inventory", icon: "inventory", href: "/manager/inventory" },
  ];

  const [kicker, label] = SCREEN_LABELS[screen] || ["", ""];

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
        overflowY: "auto",
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
        overflowY: "auto",
      };

  const sectionLabel: React.CSSProperties = {
    font: "600 9px/1 'JetBrains Mono', monospace",
    color: "#525B6B",
    letterSpacing: ".22em",
    padding: "14px 11px 8px",
  };

  function NavButton({ item }: { item: NavItem }) {
    const active = screen === item.id;
    return (
      <Link
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          width: "100%",
          padding: "10px 11px",
          marginBottom: 2,
          border: "none",
          borderRadius: 10,
          cursor: "pointer",
          font: "600 13.5px Inter, sans-serif",
          color: active ? "#fff" : "#AEB5C2",
          background: active ? "rgba(200,240,0,.07)" : "transparent",
          boxShadow: active ? `inset 2px 0 0 ${A}` : "none",
          textDecoration: "none",
        }}
      >
        {item.step ? (
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "700 9px 'JetBrains Mono', monospace",
              background: active ? A : "#1A1F2B",
              color: active ? "#0D0D12" : "#7D8799",
              zIndex: 1,
            }}
          >
            {item.step}
          </span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, flex: "none" }}>
            <MgrIcon name={item.icon!} color={active ? A : "#7D8799"} />
          </span>
        )}
        <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
        {item.badge ? (
          <span
            style={{
              font: "700 10px Inter, sans-serif",
              color: "#0D0D12",
              background: A,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
            }}
          >
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", minHeight: "100vh", background: "#0D0D12", position: "relative", fontFamily: "Inter, sans-serif" }}>
      {isMobile && sidebarOpen ? (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)" }}
        />
      ) : null}

      <aside style={asideStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 4px 20px" }}>
          <BrandMark height={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "800 16px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>Pyramid OS</div>
            <div style={{ font: "600 9px/1.4 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".2em", marginTop: 4 }}>
              COMMAND&nbsp;CENTER
            </div>
          </div>
        </div>

        <div style={sectionLabel}>MONITOR</div>
        {monitor.map((it) => (
          <NavButton key={it.id} item={it} />
        ))}

        <div style={{ ...sectionLabel, padding: "18px 11px 8px" }}>OPERATIONS</div>
        {ops.map((it) => (
          <NavButton key={it.id} item={it} />
        ))}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12, paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", border: "1px solid rgba(34,197,94,.25)", borderRadius: 10, background: "rgba(34,197,94,.05)" }}>
            <div style={{ font: "600 10px/1.3 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".06em" }}>
              SYSTEMS NOMINAL
              <br />
              <span style={{ color: "#22C55E" }}>All services online</span>
            </div>
          </div>
          <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#C8F000,#1F8A5B)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px Inter, sans-serif", color: "#0D0D12", flex: "none" }}>
              {currentUser?.initials ?? "S"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "600 12px/1.2 Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {currentUser?.name ?? "Staff"}
              </div>
              <div style={{ font: "500 10px/1.3 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>{currentUser?.title ?? "Staff"}</div>
            </div>
          </div>

          <form action={logoutAction} style={{ margin: 0 }}>
            <button
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                width: "100%",
                padding: 11,
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 10,
                background: "transparent",
                color: "#AEB5C2",
                font: "600 12px Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", maxHeight: "100vh" }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: 14,
            height: 62,
            padding: "0 24px",
            background: "rgba(13,13,18,.85)",
            backdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(255,255,255,.07)",
            flex: "none",
          }}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ display: isMobile ? "flex" : "none", width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,.1)", background: "#1D2230", color: "#fff", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "600 9px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".2em" }}>MANAGER · {kicker}</div>
            <div style={{ font: "800 16px/1.2 Inter, sans-serif", color: "#fff", letterSpacing: "-.01em", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {label}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: isMobile ? "none" : "inline-flex", alignItems: "center", gap: 9, padding: "8px 13px", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, background: "#151821" }}>
              <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>FOCUS&nbsp;EVENT</span>
              <span style={{ font: "700 12px/1 Inter, sans-serif", color: "#fff" }}>{FOCUS_EVENT_NAME}</span>
            </div>
            <div style={{ display: isNarrow ? "none" : "block", font: "600 11px/1 'JetBrains Mono', monospace", color: "#AEB5C2", letterSpacing: ".06em" }}>
              18 JUL 2026 · 14:20
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>{children}</main>
      </div>
    </div>
  );
}
