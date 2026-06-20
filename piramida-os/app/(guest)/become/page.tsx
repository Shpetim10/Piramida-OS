"use client";

import Link from "next/link";
import { useViewport } from "@/lib/useViewport";

const STEPS = [
  { n: "01", title: "Describe it", body: "Type your event the way you'd text a colleague. The AI extracts guests, rooms, equipment and timing." },
  { n: "02", title: "See the plan", body: "The Pyramid lights up your recommended rooms, with reasoning and an instant, itemized quote." },
  { n: "03", title: "Send for approval", body: "Adjust anything and re-plan live, then submit. The venue team reviews and confirms your event." },
];

export default function BecomePage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  return (
    <div>
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 56,
          paddingBottom: 40,
          textAlign: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(760px 460px at 50% 10%,rgba(200,240,0,.12),transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 740, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 14px", border: "1px solid rgba(200,240,0,.28)", borderRadius: 100, background: "rgba(200,240,0,.05)", marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8F000", boxShadow: "0 0 8px #C8F000" }} />
            <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".18em" }}>ORGANIZER STUDIO</span>
          </div>
          <h1 style={{ font: "800 clamp(34px,5.4vw,62px)/1.02 Inter, sans-serif", letterSpacing: "-.035em", margin: "0 0 18px", color: "#fff", textWrap: "balance" }}>
            Organize a world-class event here
          </h1>
          <p style={{ font: "400 clamp(15px,1.6vw,18px)/1.6 Inter, sans-serif", color: "#AEB5C2", maxWidth: 520, margin: "0 auto 30px", textWrap: "pretty" }}>
            Describe your idea in plain words. Pyramid OS matches the right rooms,
            builds a live quote, and sends it for approval — no spreadsheets, no
            back-and-forth.
          </p>
          <Link
            href="/organizer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "16px 30px",
              borderRadius: 13,
              background: "#C8F000",
              color: "#0D0D12",
              font: "700 16px Inter, sans-serif",
              boxShadow: "0 10px 36px rgba(200,240,0,.26)",
              textDecoration: "none",
            }}
          >
            Enter Organizer Studio
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>

      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 20, paddingBottom: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 26 }}>
              <div style={{ font: "800 18px 'JetBrains Mono', monospace", color: "#C8F000", marginBottom: 14 }}>{s.n}</div>
              <div style={{ font: "700 17px Inter, sans-serif", color: "#fff", marginBottom: 8 }}>{s.title}</div>
              <div style={{ font: "400 14px/1.55 Inter, sans-serif", color: "#7D8799", textWrap: "pretty" }}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
