"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function QrScannerModal({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [camError, setCamError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserMultiFormatReader();

    async function startScan() {
      if (!videoRef.current) return;
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          setCamError("No camera found on this device.");
          setScanning(false);
          return;
        }
        // Prefer back camera on mobile.
        const device =
          devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];

        await reader.decodeFromVideoDevice(device.deviceId, videoRef.current, (result, err, controls) => {
          if (stopped) {
            controls.stop();
            return;
          }
          if (result) {
            stopped = true;
            controls.stop();
            // Stop camera tracks.
            if (videoRef.current?.srcObject instanceof MediaStream) {
              videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
            }
            onDetected(result.getText());
            return;
          }
          if (err && !(err instanceof NotFoundException)) {
            setCamError("Camera error — use manual entry below.");
            setScanning(false);
            controls.stop();
          }
        });

        // Keep a ref to the stream so we can stop it on cleanup.
        if (videoRef.current?.srcObject instanceof MediaStream) {
          streamRef.current = videoRef.current.srcObject;
        }
      } catch (e) {
        if (!stopped) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
            setCamError("Camera access denied — use manual entry below.");
          } else if (msg.toLowerCase().includes("found")) {
            setCamError("No camera found — use manual entry below.");
          } else {
            setCamError("Could not start camera — use manual entry below.");
          }
          setScanning(false);
        }
      }
    }

    startScan();

    return () => {
      stopped = true;
      // streamRef is set inside startScan when the stream is active — stop it here.
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) onDetected(code);
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#151821",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px" }}>
          <div>
            <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Scan QR code</div>
            <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>
              Point the camera at an asset label
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid rgba(255,255,255,.1)",
              background: "#0F1218", color: "#7D8799",
              cursor: "pointer", font: "700 18px Inter, sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Camera viewport */}
        <div style={{ position: "relative", background: "#0F1218", aspectRatio: "4/3", overflow: "hidden" }}>
          <video
            ref={videoRef}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: camError ? "none" : "block" }}
            muted
            playsInline
          />

          {/* Scanning overlay — corner brackets + moving line */}
          {scanning && !camError && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ width: 180, height: 180, position: "relative" }}>
                {([
                  { top: 0, left: 0, borderTop: "3px solid #C8F000", borderLeft: "3px solid #C8F000" },
                  { top: 0, right: 0, borderTop: "3px solid #C8F000", borderRight: "3px solid #C8F000" },
                  { bottom: 0, left: 0, borderBottom: "3px solid #C8F000", borderLeft: "3px solid #C8F000" },
                  { bottom: 0, right: 0, borderBottom: "3px solid #C8F000", borderRight: "3px solid #C8F000" },
                ] as React.CSSProperties[]).map((s, i) => (
                  <div key={i} style={{ position: "absolute", width: 28, height: 28, borderRadius: 3, ...s }} />
                ))}
                <div
                  style={{
                    position: "absolute",
                    left: 8, right: 8, height: 2,
                    background: "linear-gradient(90deg, transparent, #C8F000, transparent)",
                    animation: "qrScanLine 1.8s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          )}

          {/* Camera error state */}
          {camError && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: 24, textAlign: "center", gap: 10,
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#39414F" strokeWidth="1.5" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
              <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799" }}>{camError}</div>
            </div>
          )}
        </div>

        {/* Manual entry */}
        <div style={{ padding: "16px 20px 20px" }}>
          <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 10 }}>
            OR ENTER CODE MANUALLY
          </div>
          <form onSubmit={submitManual} style={{ display: "flex", gap: 8 }}>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. AST-WMIC-01"
              autoComplete="off"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.1)",
                background: "#0F1218",
                color: "#fff",
                font: "500 13px Inter, sans-serif",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "#C8F000",
                color: "#0D0D12",
                font: "700 13px Inter, sans-serif",
                cursor: "pointer",
                flex: "none",
              }}
            >
              Go
            </button>
          </form>
          <div style={{ font: "400 11px Inter, sans-serif", color: "#39414F", marginTop: 8 }}>
            Demo codes: AST-WMIC-01 · AST-PROJ-01 · AST-SCREEN-01
          </div>
        </div>
      </div>

      <style>{`
        @keyframes qrScanLine {
          0%   { top: 8%;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 92%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
