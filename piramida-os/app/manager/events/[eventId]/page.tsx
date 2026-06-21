"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";

const LIME = "#C8F000";

const GENERATION_MESSAGES = [
  "Generating plan...",
  "Analyzing space requirements...",
  "Scoring available rooms...",
  "Checking asset availability...",
  "Computing Event DNA fingerprint...",
  "Detecting potential conflicts...",
  "Finalizing recommendations...",
];

type Phase = "checking" | "found" | "generating" | "done";

export default function PipelineGateway() {
  const params = useParams();
  const eventId = params.eventId as string;
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("checking");
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const progressRef = useRef(0);
  const progTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (progTimerRef.current) clearInterval(progTimerRef.current);
    if (msgTimerRef.current) clearInterval(msgTimerRef.current);
  }

  function startGenerationProgress() {
    // Cycle through generation messages
    let msgIdx = 0;
    msgTimerRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % GENERATION_MESSAGES.length;
      setMessageIndex(msgIdx);
    }, 950);

    // Simulated progress fills to ~88%, waits for POST to complete
    progTimerRef.current = setInterval(() => {
      const current = progressRef.current;
      if (current < 88) {
        const increment = (88 - current) * 0.06 + 0.4;
        const next = Math.min(current + increment, 88);
        progressRef.current = next;
        setProgress(next);
      }
    }, 120);
  }

  function finishAndRedirect() {
    progressRef.current = 100;
    setProgress(100);
    setTimeout(() => {
      router.push(`/manager/events/${eventId}/understand`);
    }, 480);
  }

  useEffect(() => {
    // Phase 1: check for an existing plan
    fetch(`/api/staff/events/${eventId}/plan`, { method: "GET" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load event (${res.status})`);
        const data = await res.json();

        const hasPlan =
          Array.isArray(data.event?.planVersions) &&
          data.event.planVersions.length > 0;

        if (hasPlan) {
          // Plan already exists — fast path, no generation needed
          setPhase("found");
          progressRef.current = 100;
          setProgress(100);
          setTimeout(() => {
            router.push(`/manager/events/${eventId}/understand`);
          }, 600);
          return;
        }

        // Phase 2: no plan — generate it
        setPhase("generating");
        startGenerationProgress();

        fetch(`/api/staff/events/${eventId}/plan`, { method: "POST" })
          .then(async (postRes) => {
            clearTimers();
            if (!postRes.ok) {
              const body = await postRes.json().catch(() => ({}));
              setError(body.error ?? `Plan generation failed (${postRes.status})`);
              return;
            }
            setPhase("done");
            finishAndRedirect();
          })
          .catch(() => {
            clearTimers();
            setError("Network error — could not reach the server.");
          });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Network error — could not load event.");
      });

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const headingText: Record<Phase, string> = {
    checking:   "Loading Event",
    found:      "Plan Ready",
    generating: "Generating Plan",
    done:       "Plan Ready",
  };

  const subText =
    phase === "checking"
      ? "Checking for existing plan..."
      : phase === "found"
      ? "Plan loaded from database — opening Event DNA..."
      : phase === "done"
      ? "Opening Event DNA..."
      : GENERATION_MESSAGES[messageIndex];

  const isReady = phase === "found" || phase === "done";

  if (error) {
    return (
      <div
        style={{
          minHeight: "calc(100vh - 62px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          background: "#0D0D12",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            padding: 32,
            border: "1px solid rgba(239,68,68,.35)",
            borderRadius: 18,
            background: "rgba(239,68,68,.06)",
            textAlign: "center",
          }}
        >
          <div style={{ font: "700 16px Inter, sans-serif", color: "#EF4444", marginBottom: 10 }}>
            {phase === "checking" ? "Could not load event" : "Plan generation failed"}
          </div>
          <div style={{ font: "400 13px/1.6 Inter, sans-serif", color: "#AEB5C2", marginBottom: 22 }}>
            {error}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 20px",
                borderRadius: 9,
                border: "none",
                background: LIME,
                color: "#0D0D12",
                font: "700 13px Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/manager/events")}
              style={{
                padding: "10px 20px",
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,.1)",
                background: "transparent",
                color: "#AEB5C2",
                font: "600 13px Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              Back to Events
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes pyramidPulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(200,240,0,.3)); }
          50%       { filter: drop-shadow(0 0 32px rgba(200,240,0,.7)); }
        }
        @keyframes gridScroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(34px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanLine {
          0%   { top: 10%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>

      <div
        style={{
          minHeight: "calc(100vh - 62px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse 900px 600px at 50% 40%, rgba(200,240,0,.04), #0D0D12)",
          position: "relative",
          overflow: "hidden",
          padding: 32,
        }}
      >
        {/* Animated grid */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              inset: "-34px 0 0",
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
              backgroundSize: "34px 34px",
              animation: "gridScroll 3s linear infinite",
            }}
          />
        </div>

        {/* Scan line — only during generation */}
        {phase === "generating" && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${LIME}50, transparent)`,
              animation: "scanLine 2.8s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            animation: "fadeInUp .5s ease both",
          }}
        >
          {/* Pyramid */}
          <div style={{ animation: "pyramidPulse 2.2s ease-in-out infinite", marginBottom: 32 }}>
            <svg width="80" height="74" viewBox="0 0 80 74" fill="none">
              <polygon points="40,6 74,68 6,68" stroke={LIME} strokeWidth="1.6" fill="none" />
              <polygon points="40,6 57,37 23,37" fill={LIME} opacity={isReady ? 1 : 0.85} />
              <line x1="40" y1="6" x2="6"  y2="68" stroke={`${LIME}30`} strokeWidth="0.5" />
              <line x1="40" y1="6" x2="74" y2="68" stroke={`${LIME}30`} strokeWidth="0.5" />
              <line x1="23" y1="37" x2="57" y2="37" stroke={`${LIME}40`} strokeWidth="0.5" />
            </svg>
          </div>

          <div
            style={{
              font: "600 10px 'JetBrains Mono', monospace",
              color: "#7D8799",
              letterSpacing: ".22em",
              marginBottom: 12,
            }}
          >
            OPERATIONAL PIPELINE
          </div>

          <div
            style={{
              font: "800 26px/1.1 Inter, sans-serif",
              color: "#fff",
              letterSpacing: "-.02em",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {headingText[phase]}
          </div>

          {/* Status message */}
          <div
            key={`${phase}-${messageIndex}`}
            style={{
              font: "400 14px/1.5 Inter, sans-serif",
              color: "#7D8799",
              marginBottom: 36,
              height: 22,
              animation: "fadeInUp .3s ease both",
              textAlign: "center",
            }}
          >
            {subText}
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: 320,
              maxWidth: "100%",
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,.07)",
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                borderRadius: 2,
                background: isReady
                  ? "#22C55E"
                  : `linear-gradient(90deg, ${LIME}80, ${LIME})`,
                transition: "width .15s ease, background .4s ease",
                boxShadow: `0 0 8px ${isReady ? "#22C55E" : LIME}60`,
              }}
            />
          </div>

          {/* Status tag */}
          <div
            style={{
              font: "700 11px 'JetBrains Mono', monospace",
              color: isReady ? "#22C55E" : LIME,
              letterSpacing: ".06em",
            }}
          >
            {phase === "checking"
              ? "CHECKING"
              : phase === "found"
              ? "CACHED"
              : isReady
              ? "READY"
              : `${Math.round(progress)}%`}
          </div>
        </div>
      </div>
    </>
  );
}
