import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileStatus, ProfileType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { DEMO_COOKIE } from "@/lib/demo/personas";

export const dynamic = "force-dynamic";

// Holding page for organizers awaiting admin approval. Reachable by a signed-in
// PENDING_APPROVAL organizer (the organizer route group bounces them here).
async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  const c = await cookies();
  c.delete(DEMO_COOKIE);
  redirect("/");
}

export default async function PendingApprovalPage() {
  const profile = await getCurrentProfile();

  // An approved organizer never needs this page.
  if (profile && profile.type === ProfileType.ORGANIZER && profile.status === ProfileStatus.ACTIVE) {
    redirect("/organizer");
  }
  // Staff/admin shouldn't land here — send them home.
  if (profile && profile.type === ProfileType.STAFF) {
    redirect("/dashboard");
  }

  const me = profile
    ? await prisma.profile.findUnique({
        where: { id: profile.id },
        select: { fullName: true, email: true, status: true },
      })
    : null;

  const declined = me?.status === ProfileStatus.DISABLED;

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
          background: "radial-gradient(680px 420px at 50% -5%,rgba(200,240,0,.10),transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 460, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 11, marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 34 34" fill="none">
            <polygon points="17,4 31,29 3,29" stroke="#C8F000" strokeWidth="1.7" />
            <polygon points="17,4 24,16.5 10,16.5" fill="#C8F000" />
          </svg>
          <div style={{ font: "800 17px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>Pyramid OS</div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, background: "#151821", padding: 32 }}>
          {declined ? (
            <>
              <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: "50%", background: "rgba(255,90,90,.12)", border: "1px solid rgba(255,90,90,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" stroke="#FF9B9B" strokeWidth="2" fill="none" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </div>
              <h1 style={{ font: "800 24px/1.1 Inter, sans-serif", letterSpacing: "-.02em", color: "#fff", margin: "0 0 10px" }}>
                Access not granted
              </h1>
              <p style={{ font: "400 14px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 8px" }}>
                The Pyramid team was unable to approve your organizer account at this time.
              </p>
            </>
          ) : (
            <>
              <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: "50%", background: "rgba(200,240,0,.12)", border: "1px solid rgba(200,240,0,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" stroke="#C8F000" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", border: "1px solid rgba(200,240,0,.28)", borderRadius: 100, background: "rgba(200,240,0,.05)", marginBottom: 16 }}>
                <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".18em" }}>PENDING APPROVAL</span>
              </div>
              <h1 style={{ font: "800 24px/1.1 Inter, sans-serif", letterSpacing: "-.02em", color: "#fff", margin: "0 0 10px" }}>
                Your request is in review
              </h1>
              <p style={{ font: "400 14px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 8px" }}>
                Thanks{me?.fullName ? `, ${me.fullName}` : ""}! The Pyramid team is reviewing your organizer account.
                You&apos;ll be able to plan and submit events as soon as it&apos;s approved.
              </p>
              {me?.email && (
                <p style={{ font: "400 13px/1.5 Inter, sans-serif", color: "#7D8799", margin: "12px 0 0" }}>
                  Signed in as <span style={{ color: "#AEB5C2" }}>{me.email}</span>. Check back after approval.
                </p>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {profile ? (
              <form action={signOut} style={{ flex: 1 }}>
                <button
                  type="submit"
                  style={{ width: "100%", borderRadius: 11, border: "1px solid rgba(255,255,255,.12)", background: "#0D0D12", color: "#fff", padding: "12px 16px", font: "600 14px Inter, sans-serif", cursor: "pointer" }}
                >
                  Sign out
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                style={{ flex: 1, borderRadius: 11, border: "1px solid rgba(255,255,255,.12)", background: "#0D0D12", color: "#fff", padding: "12px 16px", font: "600 14px Inter, sans-serif", textDecoration: "none", textAlign: "center" }}
              >
                Sign in
              </Link>
            )}
            <Link
              href="/events"
              style={{ flex: 1, borderRadius: 11, border: "none", background: "#C8F000", color: "#0D0D12", padding: "12px 16px", font: "700 14px Inter, sans-serif", textDecoration: "none", textAlign: "center" }}
            >
              View events
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
