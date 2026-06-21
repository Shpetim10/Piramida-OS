"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LIME = "#C8F000";

const STEPS = [
  { id: "understand", label: "Understand", step: "01" },
  { id: "simulate",  label: "Simulate",   step: "02" },
  { id: "protect",   label: "Protect",    step: "03" },
  { id: "explain",   label: "Explain",    step: "04" },
  { id: "launch",    label: "Launch",     step: "05" },
];

export function PipelineStepNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const currentStepId = pathname.split("/").pop() ?? "understand";
  const currentIndex = STEPS.findIndex((s) => s.id === currentStepId);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  const prevStep = safeIndex > 0 ? STEPS[safeIndex - 1] : null;
  const nextStep = safeIndex < STEPS.length - 1 ? STEPS[safeIndex + 1] : null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 24px",
        height: 52,
        background: "rgba(13,13,18,.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        flex: "none",
      }}
    >
      {/* Back button */}
      {prevStep ? (
        <Link
          href={`/manager/events/${eventId}/${prevStep.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 11px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.1)",
            background: "transparent",
            color: "#AEB5C2",
            font: "600 11px Inter, sans-serif",
            textDecoration: "none",
            cursor: "pointer",
            flex: "none",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </Link>
      ) : (
        <div style={{ width: 68, flex: "none" }} />
      )}

      {/* Step indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" }}>
        {STEPS.map((step, idx) => {
          const isActive = idx === safeIndex;
          const isDone = idx < safeIndex;

          return (
            <Link
              key={step.id}
              href={`/manager/events/${eventId}/${step.id}`}
              style={{ textDecoration: "none", display: "flex", alignItems: "center" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 8,
                  border: isActive
                    ? `1px solid ${LIME}40`
                    : isDone
                    ? "1px solid rgba(34,197,94,.2)"
                    : "1px solid transparent",
                  background: isActive
                    ? `${LIME}10`
                    : isDone
                    ? "rgba(34,197,94,.06)"
                    : "transparent",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                    background: isActive ? LIME : isDone ? "#22C55E" : "#1A1F2B",
                    color: isActive || isDone ? "#0D0D12" : "#7D8799",
                    font: "700 9px 'JetBrains Mono', monospace",
                  }}
                >
                  {isDone ? (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l5 5L20 6" />
                    </svg>
                  ) : (
                    step.step
                  )}
                </span>
                <span
                  style={{
                    font: "600 11px Inter, sans-serif",
                    color: isActive ? "#fff" : isDone ? "#22C55E" : "#525B6B",
                    display: "none",
                  }}
                  className="step-label"
                >
                  {step.label}
                </span>
                <span
                  style={{
                    font: "600 11px Inter, sans-serif",
                    color: isActive ? "#fff" : isDone ? "#22C55E" : "#525B6B",
                  }}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  style={{
                    width: 20,
                    height: 1,
                    background: isDone ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.07)",
                    margin: "0 2px",
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Next button */}
      {nextStep ? (
        <Link
          href={`/manager/events/${eventId}/${nextStep.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 11px",
            borderRadius: 8,
            border: `1px solid ${LIME}40`,
            background: `${LIME}0D`,
            color: LIME,
            font: "600 11px Inter, sans-serif",
            textDecoration: "none",
            cursor: "pointer",
            flex: "none",
          }}
        >
          Next
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      ) : (
        <div style={{ width: 68, flex: "none" }} />
      )}
    </div>
  );
}
