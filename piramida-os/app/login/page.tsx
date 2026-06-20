import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileStatus, ProfileType, type RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { DEMO_PERSONAS, DEMO_COOKIE } from "@/lib/demo/personas";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: RoleCode[] = ["SUPER_ADMIN", "ADMIN"];

function safeNext(next: string | undefined): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

async function landingForAuthUser(authUserId: string): Promise<string> {
  const profile = await prisma.profile.findFirst({
    where: { authUserId, deletedAt: null },
    select: { type: true, status: true, profileRoles: { select: { role: { select: { code: true } } } } },
  });
  if (!profile) return "/dashboard";
  const roleCodes = profile.profileRoles.map((pr) => pr.role.code);
  if (roleCodes.some((r) => ADMIN_ROLES.includes(r))) return "/admin";
  if (profile.type === ProfileType.STAFF) return "/manager";
  if (profile.type === ProfileType.ORGANIZER) {
    return profile.status === ProfileStatus.ACTIVE ? "/organizer" : "/pending-approval";
  }
  return "/dashboard";
}

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next")?.toString() || undefined);
  const back = (msg: string) =>
    `/login?error=${encodeURIComponent(msg)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  if (!email || !password) redirect(back("Enter your email and password"));

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(back("Authentication is not configured"));

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect(back(error?.message ?? "Invalid email or password"));

  redirect(next ?? (await landingForAuthUser(data.user.id)));
}

async function loginAs(formData: FormData) {
  "use server";
  const profileId = String(formData.get("profileId"));
  const valid = DEMO_PERSONAS.some((p) => p.profileId === profileId);
  if (!valid) return;
  const c = await cookies();
  c.set(DEMO_COOKIE, profileId, { httpOnly: true, sameSite: "lax", path: "/" });
  const next = safeNext(formData.get("next")?.toString() || undefined);
  redirect(next ?? (await landingForAuthUser(profileId)));
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextDest = safeNext(next);
  const demoMode = process.env.DEMO_MODE === "true";

  const labelStyle: React.CSSProperties = {
    display: "block",
    font: "600 11px/1 Inter, sans-serif",
    letterSpacing: ".02em",
    color: "#7D8799",
    marginBottom: 8,
  };
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
          background:
            "radial-gradient(680px 420px at 50% -5%,rgba(200,240,0,.12),transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 420 }}>
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            marginBottom: 22,
          }}
        >
          <BrandLogo height={84} />
        </Link>

        <div
          style={{
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 20,
            background: "#151821",
            padding: 28,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "6px 13px", border: "1px solid rgba(200,240,0,.28)", borderRadius: 100, background: "rgba(200,240,0,.05)", marginBottom: 18 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8F000", boxShadow: "0 0 8px #C8F000" }} />
            <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".18em" }}>
              LAUNCH CONTROL
            </span>
          </div>

          <h1 style={{ font: "800 26px/1.05 Inter, sans-serif", letterSpacing: "-.03em", color: "#fff", margin: "0 0 7px" }}>
            Sign in
          </h1>
          <p style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 22px" }}>
            Access launch control for the Pyramid of Tirana.
          </p>

          {error && (
            <div style={{ marginBottom: 18, borderRadius: 11, border: "1px solid rgba(255,90,90,.32)", background: "rgba(255,90,90,.08)", padding: "11px 14px", font: "500 13px/1.4 Inter, sans-serif", color: "#FF9B9B" }}>
              {error}
            </div>
          )}

          <form action={signIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {nextDest && <input type="hidden" name="next" value={nextDest} />}
            <div>
              <label htmlFor="email" style={labelStyle}>EMAIL</label>
              <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@pyramidos.al" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="password" style={labelStyle}>PASSWORD</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" style={inputStyle} />
            </div>
            <button
              type="submit"
              style={{
                marginTop: 2,
                width: "100%",
                borderRadius: 11,
                border: "none",
                background: "#C8F000",
                color: "#0D0D12",
                padding: "13px 18px",
                font: "700 14px Inter, sans-serif",
                cursor: "pointer",
                boxShadow: "0 8px 26px rgba(200,240,0,.22)",
              }}
            >
              Sign in
            </button>
          </form>

          {demoMode && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,.08)" }} />
                <span style={{ font: "600 9px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".18em" }}>
                  DEMO PERSONAS
                </span>
                <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,.08)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DEMO_PERSONAS.map((p) => (
                  <form key={p.profileId} action={loginAs}>
                    <input type="hidden" name="profileId" value={p.profileId} />
                    {nextDest && <input type="hidden" name="next" value={nextDest} />}
                    <button
                      type="submit"
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        borderRadius: 11,
                        border: "1px solid rgba(255,255,255,.09)",
                        background: "#0D0D12",
                        padding: "11px 14px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ font: "600 14px Inter, sans-serif", color: "#fff" }}>{p.label}</span>
                      <span style={{ font: "600 10px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: "#C8F000", background: "rgba(200,240,0,.08)", border: "1px solid rgba(200,240,0,.2)", borderRadius: 6, padding: "3px 7px" }}>
                        {p.role}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <Link href="/events" style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", textDecoration: "none" }}>
            View public events →
          </Link>
        </div>
      </div>
    </main>
  );
}
