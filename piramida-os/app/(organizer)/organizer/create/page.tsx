"use client";

import Link from "next/link";
import { useState } from "react";
import { PyramidTwin } from "@/lib/PyramidTwin";
import { useViewport } from "@/lib/useViewport";
import {
  DEFAULT_PROMPT,
  DURATION_MULT,
  DURATIONS,
  EQUIPMENT,
  EXAMPLE_PROMPTS,
  fmt,
  recRooms,
  ROOM_NAME,
  ROOM_PRICE,
  ROOM_REASON,
  ROOM_ROLE,
  SERVICES,
} from "@/lib/data";

type Stage = "prompt" | "result" | "sent";

const sparkle = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0D0D12">
    <path d="M12 3l1.8 4.8L18.6 9.6 13.8 11.4 12 16.2 10.2 11.4 5.4 9.6 10.2 7.8z" />
  </svg>
);

export default function CreateEventPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  const [stage, setStage] = useState<Stage>("prompt");
  const [text, setText] = useState("");
  const [attendees, setAttendees] = useState(180);
  const [duration, setDuration] = useState("Full day");
  const [equip, setEquip] = useState<string[]>(["av"]);
  const [services, setServices] = useState<string[]>(["catering", "registration"]);

  const mult = DURATION_MULT[duration] ?? 1;
  const rooms = recRooms(attendees);

  const roomLines = rooms.map((id) => ({
    label: ROOM_NAME[id],
    role: ROOM_ROLE[id],
    amount: "€" + fmt(ROOM_PRICE[id] * mult),
  }));
  const equipLines = EQUIPMENT.filter((e) => equip.includes(e.id)).map((e) => ({
    label: e.label,
    amount: "€" + fmt(e.price),
  }));
  const serviceLines = SERVICES.filter((s) => services.includes(s.id)).map((s) => ({
    label: s.label,
    amount: "€" + fmt(s.perHead ? s.perHead * attendees : s.price ?? 0),
  }));

  const roomCost = rooms.reduce((t, id) => t + ROOM_PRICE[id] * mult, 0);
  const equipCost = EQUIPMENT.filter((e) => equip.includes(e.id)).reduce((t, e) => t + e.price, 0);
  const serviceCost = SERVICES.filter((s) => services.includes(s.id)).reduce(
    (t, s) => t + (s.perHead ? s.perHead * attendees : s.price ?? 0),
    0
  );
  const subtotal = roomCost + equipCost + serviceCost;
  const svc = subtotal * 0.1;
  const total = subtotal + svc;

  const reasonBullets = rooms.map((id) => ({ room: ROOM_NAME[id], text: ROOM_REASON[id] }));
  const summaryRooms = rooms.map((id) => ROOM_NAME[id]).join(" · ");
  const convText = text || DEFAULT_PROMPT;

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function submitPrompt() {
    setText((t) => t || DEFAULT_PROMPT);
    setStage("result");
  }

  async function sendRequest() {
    const rawText = text || DEFAULT_PROMPT;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/organizer/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, channel: "portal" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError(d.error ?? "Submission failed. Please try again.");
        return;
      }
      setStage("sent");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const optionButton = (
    on: boolean,
    onClick: () => void,
    label: string,
    sub: string,
    key: string
  ) => (
    <button
      key={key}
      onClick={onClick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        padding: "13px 14px",
        borderRadius: 12,
        border: `1px solid ${on ? "rgba(200,240,0,.4)" : "rgba(255,255,255,.09)"}`,
        background: on ? "rgba(200,240,0,.06)" : "#151821",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "700 11px Inter, sans-serif",
            color: "#0D0D12",
            background: on ? "#C8F000" : "transparent",
            border: `1px solid ${on ? "#C8F000" : "rgba(255,255,255,.2)"}`,
          }}
        >
          {on ? "✓" : ""}
        </span>
        <div>
          <div style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>{label}</div>
          <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{sub}</div>
        </div>
      </div>
    </button>
  );

  return (
    <div>
      {stage === "prompt" && (
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 40,
            paddingBottom: 54,
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(720px 440px at 50% 6%,rgba(200,240,0,.08),transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
            <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 14 }}>
              CREATE EVENT
            </div>
            <h1 style={{ font: "800 clamp(28px,4.4vw,48px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 12px", color: "#fff", textWrap: "balance" }}>
              What do you want to host?
            </h1>
            <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 480, margin: "0 auto", textWrap: "pretty" }}>
              Describe your event in plain words. The Pyramid will find your rooms.
            </p>
            <div style={{ maxWidth: 540, margin: "18px auto 0", animation: "floatY 8s ease-in-out infinite" }}>
              <PyramidTwin selected={rooms} labels showRoutes />
            </div>
          </div>
          <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
            <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, background: "#151821", padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,.4)" }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. A startup conference for 180 people with a keynote, two breakout rooms and a networking area with coffee…"
                style={{
                  width: "100%",
                  minHeight: 120,
                  resize: "none",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "#fff",
                  font: "400 16px/1.6 Inter, sans-serif",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setText(p.text);
                        setAttendees(p.att);
                      }}
                      style={{
                        padding: "8px 13px",
                        borderRadius: 100,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "transparent",
                        color: "#AEB5C2",
                        font: "500 12px Inter, sans-serif",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={submitPrompt}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "13px 22px",
                    borderRadius: 12,
                    background: "#C8F000",
                    color: "#0D0D12",
                    font: "700 14px Inter, sans-serif",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    border: "none",
                  }}
                >
                  {sparkle}
                  Generate plan
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {stage === "result" && (
        <>
          <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 32, paddingBottom: 8, maxWidth: 980 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em" }}>
                CREATE EVENT · CONVERSATION
              </div>
              <button onClick={() => setStage("prompt")} style={{ font: "600 12px Inter, sans-serif", color: "#C8F000", background: "none", border: "none", cursor: "pointer" }}>
                ↺ Re-describe
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <div style={{ maxWidth: 560, padding: "14px 18px", borderRadius: "16px 16px 4px 16px", background: "#1D2230", border: "1px solid rgba(255,255,255,.08)", font: "400 15px/1.55 Inter, sans-serif", color: "#fff" }}>
                {convText}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flex: "none", background: "rgba(200,240,0,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sparkle}
              </div>
              <div style={{ maxWidth: 600, padding: "14px 18px", borderRadius: "4px 16px 16px 16px", background: "rgba(200,240,0,.05)", border: "1px solid rgba(200,240,0,.18)", font: "400 15px/1.55 Inter, sans-serif", color: "#AEB5C2" }}>
                Got it — I&apos;ve highlighted{" "}
                <b style={{ color: "#fff" }}>{rooms.length} recommended spaces</b> in the
                Pyramid and built a live quote. Adjust attendees, duration or services on
                the right and I&apos;ll re-plan instantly.
              </div>
            </div>
          </section>

          <section
            style={{
              paddingLeft: padX,
              paddingRight: padX,
              paddingTop: 24,
              paddingBottom: 54,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.15fr 1fr",
              gap: 22,
              alignItems: "start",
            }}
          >
            <div style={{ position: "sticky", top: 20 }}>
              <div
                style={{
                  position: "relative",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 20,
                  background: "radial-gradient(680px 420px at 50% 35%,rgba(200,240,0,.06),#0B0E13)",
                  overflow: "hidden",
                  minHeight: "clamp(320px,40vw,460px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 22,
                }}
              >
                <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "38px 38px" }} />
                <div style={{ position: "absolute", top: 16, left: 16, padding: "7px 12px", borderRadius: 8, background: "rgba(13,13,18,.6)", border: "1px solid rgba(255,255,255,.08)", font: "600 10px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".1em" }}>
                  RECOMMENDED SPACES
                </div>
                <div style={{ position: "relative", width: "100%", maxWidth: 520 }}>
                  <PyramidTwin selected={rooms} labels showRoutes />
                </div>
              </div>
              <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, background: "#151821", padding: 18 }}>
                <div style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 12 }}>
                  WHY THESE ROOMS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reasonBullets.map((b) => (
                    <div key={b.room} style={{ display: "flex", gap: 10 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: "#C8F000", flex: "none", marginTop: 6 }} />
                      <div style={{ font: "400 13px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>
                        <b style={{ color: "#fff" }}>{b.room}</b> — {b.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 20 }}>
                <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em", marginBottom: 16 }}>
                  EVENT REQUIREMENTS · LIVE
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>Attendees</span>
                  <span style={{ font: "700 15px 'JetBrains Mono', monospace", color: "#C8F000" }}>{attendees}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <button onClick={() => setAttendees((v) => Math.max(20, v - 10))} style={stepBtn}>−</button>
                  <input
                    type="range"
                    min={20}
                    max={450}
                    value={attendees}
                    onChange={(e) => setAttendees(+e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => setAttendees((v) => Math.min(450, v + 10))} style={stepBtn}>+</button>
                </div>

                <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", marginBottom: 10 }}>Duration</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  {DURATIONS.map((d) => {
                    const on = duration === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 9,
                          border: `1px solid ${on ? "#C8F000" : "rgba(255,255,255,.1)"}`,
                          background: on ? "#C8F000" : "transparent",
                          color: on ? "#0D0D12" : "#AEB5C2",
                          font: "600 12px Inter, sans-serif",
                          cursor: "pointer",
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", marginBottom: 10 }}>Equipment</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                  {EQUIPMENT.map((e) =>
                    optionButton(equip.includes(e.id), () => toggle(equip, setEquip, e.id), e.label, e.sub, e.id)
                  )}
                </div>

                <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", marginBottom: 10 }}>Services</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {SERVICES.map((s) =>
                    optionButton(services.includes(s.id), () => toggle(services, setServices, s.id), s.label, s.sub, s.id)
                  )}
                </div>
              </div>

              <div style={{ border: "1px solid rgba(200,240,0,.22)", borderRadius: 18, background: "linear-gradient(180deg,rgba(200,240,0,.05),#151821)", padding: 20 }}>
                <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".16em", marginBottom: 14 }}>
                  LIVE QUOTE
                </div>
                {roomLines.map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ flex: 1, font: "600 13px Inter, sans-serif", color: "#fff" }}>{l.label}</span>
                    <span style={{ font: "500 11px Inter, sans-serif", color: "#7D8799" }}>{l.role}</span>
                    <span style={{ font: "600 13px 'JetBrains Mono', monospace", color: "#fff", width: 72, textAlign: "right" }}>{l.amount}</span>
                  </div>
                ))}
                {[...equipLines, ...serviceLines].map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ flex: 1, font: "600 13px Inter, sans-serif", color: "#AEB5C2" }}>{l.label}</span>
                    <span style={{ font: "600 13px 'JetBrains Mono', monospace", color: "#fff", width: 72, textAlign: "right" }}>{l.amount}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", font: "500 13px Inter, sans-serif", color: "#7D8799" }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>€{fmt(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0 12px", font: "500 13px Inter, sans-serif", color: "#7D8799", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <span>Service (10%)</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>€{fmt(svc)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 0", font: "800 24px Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>
                  <span>Total</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#C8F000" }}>€{fmt(total)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {submitError && (
                  <div style={{ width: "100%", font: "500 12px Inter, sans-serif", color: "#EF4444", marginBottom: 4 }}>
                    {submitError}
                  </div>
                )}
                <button
                  onClick={sendRequest}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    minWidth: 180,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 15,
                    border: "none",
                    borderRadius: 12,
                    background: submitting ? "#2A3040" : "#C8F000",
                    color: submitting ? "#7D8799" : "#0D0D12",
                    font: "700 14px Inter, sans-serif",
                    cursor: submitting ? "default" : "pointer",
                    boxShadow: submitting ? "none" : "0 8px 26px rgba(200,240,0,.2)",
                  }}
                >
                  {submitting ? "Submitting…" : "Approve & send for approval"}
                </button>
                <button
                  onClick={() => setStage("prompt")}
                  style={{ padding: "15px 20px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, background: "transparent", color: "#fff", font: "600 14px Inter, sans-serif", cursor: "pointer" }}
                >
                  Request changes
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {stage === "sent" && (
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 70,
            paddingBottom: 70,
            textAlign: "center",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(640px 420px at 50% 20%,rgba(34,197,94,.12),transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", maxWidth: 560, margin: "0 auto" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", font: "700 32px Inter, sans-serif", color: "#0D0D12", boxShadow: "0 0 0 8px rgba(34,197,94,.14)" }}>
              ✓
            </div>
            <h1 style={{ font: "800 clamp(28px,4.6vw,48px)/1.05 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff", textWrap: "balance" }}>
              Request sent for manager approval
            </h1>
            <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", margin: "0 auto 24px", maxWidth: 440, textWrap: "pretty" }}>
              Your plan has been submitted. The venue team will review your spaces and
              quote, and you&apos;ll be notified once it&apos;s confirmed.
            </p>
            <div style={{ display: "inline-flex", flexDirection: "column", gap: 10, border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, background: "#151821", padding: "18px 22px", textAlign: "left", marginBottom: 28, minWidth: 300 }}>
              <div style={summaryRow}><span>Spaces</span><span style={{ color: "#fff" }}>{summaryRooms}</span></div>
              <div style={summaryRow}><span>Attendees</span><span style={{ color: "#fff" }}>{attendees}</span></div>
              <div style={summaryRow}><span>Estimated total</span><span style={{ color: "#C8F000", fontFamily: "'JetBrains Mono', monospace" }}>€{fmt(total)}</span></div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/organizer/requests" style={{ padding: "14px 24px", borderRadius: 12, background: "#C8F000", color: "#0D0D12", font: "700 14px Inter, sans-serif", textDecoration: "none" }}>
                View in Requests
              </Link>
              <Link href="/organizer" style={{ padding: "14px 24px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, background: "transparent", color: "#fff", font: "600 14px Inter, sans-serif", textDecoration: "none" }}>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  flex: "none",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.12)",
  background: "#1D2230",
  color: "#fff",
  font: "600 18px Inter, sans-serif",
  cursor: "pointer",
  lineHeight: 1,
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  font: "500 13px Inter, sans-serif",
  color: "#7D8799",
};
