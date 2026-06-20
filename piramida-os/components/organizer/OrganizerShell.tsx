"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useViewport } from "@/lib/useViewport";

const ICONS: Record<string, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  create: "M12 3l1.8 4.8L18.6 9.6 13.8 11.4 12 16.2 10.2 11.4 5.4 9.6 10.2 7.8z",
  myevents: "M3 5h18v16H3zM3 9.5h18M8 3v4M16 3v4",
  requests: "M5 4h11l3 3v13H5zM15 4v4h4M8 13h7M8 17h5",
  profile: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6",
};

const NAV = [
  { href: "/organizer", label: "Dashboard", icon: "dashboard" },
  { href: "/organizer/create", label: "Create Event", icon: "create" },
  { href: "/organizer/events", label: "My Events", icon: "myevents" },
  { href: "/organizer/requests", label: "Requests", icon: "requests" },
  { href: "/organizer/profile", label: "Profile", icon: "profile" },
];

function Icon({ name, color }: { name: string; color: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[name] ?? ""} />
    </svg>
  );
}

export function OrganizerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isMobile } = useViewport();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const asideStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
        width: 264,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        padding: "22px 16px",
        background: "#151821",
        borderRight: "1px solid rgba(255,255,255,.07)",
        transform: sidebarOpen ? "translateX(0)" : "translateX(-110%)",
        transition: "transform .3s cubic-bezier(.2,.8,.2,1)",
        boxShadow: "24px 0 60px rgba(0,0,0,.5)",
      }
    : {
        position: "sticky",
        top: 0,
        height: "100vh",
        width: 258,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        padding: "24px 18px",
        background: "#151821",
        borderRight: "1px solid rgba(255,255,255,.07)",
      };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0D0D12",
        display: "flex",
        flexDirection: "row",
        position: "relative",
      }}
    >
      <aside style={asideStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 4px 22px" }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <polygon points="17,4 31,29 3,29" stroke="#C8F000" strokeWidth="1.6" />
            <polygon points="17,4 24,16.5 10,16.5" fill="#C8F000" opacity="0.9" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "800 16px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>
              Pyramid OS
            </div>
            <div
              style={{
                font: "600 9px/1.4 'JetBrains Mono', monospace",
                color: "#7D8799",
                letterSpacing: ".18em",
                marginTop: 4,
              }}
            >
              ORGANIZER&nbsp;STUDIO
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          {NAV.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  width: "100%",
                  padding: "11px 11px",
                  marginBottom: 3,
                  borderRadius: 10,
                  font: "600 13.5px Inter, sans-serif",
                  color: active ? "#fff" : "#AEB5C2",
                  background: active ? "rgba(200,240,0,.07)" : "transparent",
                  boxShadow: active ? "inset 2px 0 0 #C8F000" : "none",
                  textDecoration: "none",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, flex: "none" }}>
                  <Icon name={it.icon} color={active ? "#C8F000" : "#7D8799"} />
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    flex: "none",
                    background: active ? "#C8F000" : "transparent",
                  }}
                />
              </Link>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: 11,
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 10,
              background: "transparent",
              color: "#AEB5C2",
              font: "600 12px Inter, sans-serif",
              textDecoration: "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Exit to public site
          </Link>
          <div
            style={{
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,.06)",
              display: "flex",
              alignItems: "center",
              gap: 11,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#2A6FDB,#1F8A5B)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "700 12px Inter, sans-serif",
                color: "#fff",
                flex: "none",
              }}
            >
              AB
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  font: "600 12px/1.2 Inter, sans-serif",
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Adriatik Berisha
              </div>
              <div style={{ font: "500 10px/1.3 'JetBrains Mono', monospace", color: "#7D8799" }}>
                Organizer · Lumen Labs
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {isMobile && (
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              gap: 12,
              height: 58,
              padding: "0 16px",
              background: "rgba(13,13,18,.82)",
              backdropFilter: "blur(14px)",
              borderBottom: "1px solid rgba(255,255,255,.07)",
            }}
          >
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle navigation"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.1)",
                background: "#1D2230",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <svg width="24" height="24" viewBox="0 0 34 34" fill="none">
              <polygon points="17,4 31,29 3,29" stroke="#C8F000" strokeWidth="1.8" />
              <polygon points="17,4 24,16.5 10,16.5" fill="#C8F000" />
            </svg>
            <div style={{ font: "800 15px Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>
              Organizer Studio
            </div>
          </header>
        )}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            background: "#0D0D12",
            color: "#fff",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {children}
        </main>
      </div>

      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,.55)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}
    </div>
  );
}
