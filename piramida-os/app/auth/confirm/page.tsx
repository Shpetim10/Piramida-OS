"use client";

// Supabase invite / recovery links use the implicit flow:
// the token lands in the URL hash (#access_token=...&type=invite),
// which is never sent to the server. This client page reads the hash,
// calls setSession() to establish the cookie session, then redirects.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1); // strip leading #
    const params = new URLSearchParams(hash);

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (!accessToken || !refreshToken) {
      setError("Invalid or expired confirmation link. Please ask an admin to resend your invite.");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        // Invite and recovery both need a password set.
        if (type === "invite" || type === "recovery") {
          router.replace("/set-password");
        } else {
          router.replace("/dashboard");
        }
      });
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0D0D12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {error ? (
        <div style={{ maxWidth: 420, padding: 28, borderRadius: 20, border: "1px solid rgba(255,90,90,.32)", background: "rgba(255,90,90,.06)", textAlign: "center" }}>
          <div style={{ font: "700 15px Inter, sans-serif", color: "#fff", marginBottom: 10 }}>
            Confirmation failed
          </div>
          <div style={{ font: "400 13px/1.6 Inter, sans-serif", color: "#FF9B9B" }}>{error}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <svg width="32" height="32" viewBox="0 0 34 34" fill="none">
            <polygon points="17,4 31,29 3,29" stroke="#C8F000" strokeWidth="1.7" />
            <polygon points="17,4 24,16.5 10,16.5" fill="#C8F000" />
          </svg>
          <div style={{ font: "600 13px Inter, sans-serif", color: "#AEB5C2" }}>
            Confirming your account…
          </div>
        </div>
      )}
    </main>
  );
}
