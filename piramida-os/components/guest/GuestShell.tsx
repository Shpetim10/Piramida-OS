"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useViewport } from "@/lib/useViewport";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore Pyramid" },
  { href: "/events", label: "Events" },
  { href: "/past", label: "Past Events" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/events") return pathname.startsWith("/events");
  return pathname === href;
}

export function GuestShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isMobile } = useViewport();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0D0D12",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          height: 60,
          padding: isMobile ? "0 18px" : "0 52px",
          background: "rgba(13,13,18,.82)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            textDecoration: "none",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
            <polygon points="17,4 31,29 3,29" stroke="#C8F000" strokeWidth="1.7" />
            <polygon points="17,4 24,16.5 10,16.5" fill="#C8F000" />
          </svg>
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                font: "800 16px/1 Inter, sans-serif",
                color: "#fff",
                letterSpacing: "-.02em",
              }}
            >
              Pyramid OS
            </div>
            <div
              style={{
                font: "600 8px/1.4 'JetBrains Mono', monospace",
                color: "#7D8799",
                letterSpacing: ".22em",
                marginTop: 3,
              }}
            >
              PYRAMID OF TIRANA
            </div>
          </div>
        </Link>

        <nav
          style={{
            display: isMobile ? "none" : "flex",
            alignItems: "center",
            gap: 26,
          }}
        >
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  padding: "9px 4px",
                  font: "600 14px Inter, sans-serif",
                  color: active ? "#fff" : "#AEB5C2",
                  borderBottom: `2px solid ${active ? "#C8F000" : "transparent"}`,
                  textDecoration: "none",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/become"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 18px",
              borderRadius: 10,
              background: "#C8F000",
              color: "#0D0D12",
              font: "700 13px Inter, sans-serif",
              whiteSpace: "nowrap",
              boxShadow: "0 6px 22px rgba(200,240,0,.2)",
              textDecoration: "none",
            }}
          >
            Become an Organizer
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            style={{
              display: isMobile ? "flex" : "none",
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.1)",
              background: "#1D2230",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      {menuOpen && isMobile && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: 0,
            right: 0,
            zIndex: 45,
            background: "#151821",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            padding: "12px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              style={{
                textAlign: "left",
                padding: 12,
                borderRadius: 10,
                background: "transparent",
                color: "#AEB5C2",
                font: "600 15px Inter, sans-serif",
                textDecoration: "none",
              }}
            >
              {n.label}
            </Link>
          ))}
        </div>
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
  );
}
