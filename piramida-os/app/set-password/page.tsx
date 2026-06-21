"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { BrandMark } from "@/components/BrandLogo";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,.1)",
    background: "#0D0D12",
    color: "#fff",
    padding: "12px 14px",
    font: "500 14px Inter, sans-serif",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    font: "600 11px/1 Inter, sans-serif",
    letterSpacing: ".02em",
    color: "#7D8799",
    marginBottom: 8,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      // Fetch the session to determine where to send the user.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const profile = await res.json();
        const roleCodes: string[] = profile?.profileRoles?.map((pr: { role: { code: string } }) => pr.role.code) ?? [];
        if (roleCodes.some((r) => ["ADMIN", "SUPER_ADMIN"].includes(r))) {
          router.push("/admin");
        } else {
          router.push("/manager");
        }
      } else {
        router.push("/dashboard");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0D0D12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(680px 420px at 50% -5%,rgba(200,240,0,.12),transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 420 }}>
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11, textDecoration: "none", marginBottom: 22 }}
        >
          <BrandMark height={32} />
          <div style={{ textAlign: "left" }}>
            <div style={{ font: "800 17px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>Pyramid OS</div>
            <div style={{ font: "600 8px/1.4 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".22em", marginTop: 3 }}>PYRAMID OF TIRANA</div>
          </div>
        </Link>

        <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, background: "#151821", padding: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "6px 13px", border: "1px solid rgba(200,240,0,.28)", borderRadius: 100, background: "rgba(200,240,0,.05)", marginBottom: 18 }}>
            <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".18em" }}>ACCESS SETUP</span>
          </div>

          <h1 style={{ font: "800 24px/1.05 Inter, sans-serif", letterSpacing: "-.03em", color: "#fff", margin: "0 0 7px" }}>
            Set your password
          </h1>
          <p style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 22px" }}>
            Choose a password to secure your Pyramid OS account.
          </p>

          {error && (
            <div style={{ marginBottom: 18, borderRadius: 11, border: "1px solid rgba(255,90,90,.32)", background: "rgba(255,90,90,.08)", padding: "11px 14px", font: "500 13px/1.4 Inter, sans-serif", color: "#FF9B9B" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label htmlFor="password" style={labelStyle}>PASSWORD</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="confirm" style={labelStyle}>CONFIRM PASSWORD</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your password"
                required
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 2,
                width: "100%",
                borderRadius: 11,
                border: "none",
                background: saving ? "rgba(200,240,0,.5)" : "#C8F000",
                color: "#0D0D12",
                padding: "13px 18px",
                font: "700 14px Inter, sans-serif",
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: "0 8px 26px rgba(200,240,0,.22)",
              }}
            >
              {saving ? "Saving…" : "Set password & continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
