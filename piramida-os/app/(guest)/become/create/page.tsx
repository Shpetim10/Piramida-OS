import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signupOrganizer } from "@/lib/services/organizers";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { DEMO_COOKIE } from "@/lib/demo/personas";
import { BrandMark } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

// External organizer self-signup. Creates an auth account + a PENDING_APPROVAL
// organizer Profile (via signupOrganizer), signs the new organizer in, then
// sends them to /pending-approval. They cannot reach the organizer studio until
// an admin approves them (see lib/auth/page-guards.ts:requireOrganizerPage).
async function createOrganizer(formData: FormData) {
  "use server";

  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || undefined;
  const website = String(formData.get("website") ?? "").trim() || undefined;
  const organizationDescription = String(formData.get("organizationDescription") ?? "").trim() || undefined;
  const reasonForAccess = String(formData.get("reasonForAccess") ?? "").trim() || undefined;

  const back = (msg: string) => redirect(`/become/create?error=${encodeURIComponent(msg)}`);

  if (!organizationName || !contactName || !contactEmail || !password) {
    back("Please fill in organization, name, email and password.");
  }
  if (password.length < 6) {
    back("Password must be at least 6 characters.");
  }

  const demoMode = process.env.DEMO_MODE === "true";
  const admin = createSupabaseAdminClient();

  let errMsg = "";
  try {
    let authUserId: string;

    if (!demoMode && admin) {
      // Real auth: create an email-confirmed Supabase user (matches create-admin.ts).
      const created = await admin.auth.admin.createUser({
        email: contactEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: contactName },
      });
      if (created.error || !created.data.user) {
        throw new Error(created.error?.message ?? "Could not create your account.");
      }
      authUserId = created.data.user.id;
    } else {
      // Demo / no Supabase: synthesize an id that the demo cookie can resolve.
      authUserId = randomUUID();
    }

    await signupOrganizer({
      organizationName,
      contactName,
      contactEmail,
      phone,
      website,
      organizationDescription,
      reasonForAccess,
      authUserId,
    });

    // Establish a session so /pending-approval recognizes them.
    if (!demoMode && admin) {
      const supabase = await createSupabaseServerClient();
      if (supabase) await supabase.auth.signInWithPassword({ email: contactEmail, password });
    } else {
      const c = await cookies();
      c.set(DEMO_COOKIE, authUserId, { httpOnly: true, sameSite: "lax", path: "/" });
    }
  } catch (e) {
    errMsg = e instanceof Error ? e.message : "Signup failed. Please try again.";
  }

  if (errMsg) back(errMsg);
  redirect("/pending-approval");
}

export default async function CreateOrganizerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
          background: "radial-gradient(680px 420px at 50% -5%,rgba(200,240,0,.12),transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 480 }}>
        <Link
          href="/become"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11, textDecoration: "none", marginBottom: 22 }}
        >
          <BrandMark height={32} />
          <div style={{ textAlign: "left" }}>
            <div style={{ font: "800 17px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>Pyramid OS</div>
            <div style={{ font: "600 8px/1.4 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".22em", marginTop: 3 }}>
              ORGANIZER STUDIO
            </div>
          </div>
        </Link>

        <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, background: "#151821", padding: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "6px 13px", border: "1px solid rgba(200,240,0,.28)", borderRadius: 100, background: "rgba(200,240,0,.05)", marginBottom: 18 }}>
            <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".18em" }}>REQUEST ACCESS</span>
          </div>

          <h1 style={{ font: "800 26px/1.05 Inter, sans-serif", letterSpacing: "-.03em", color: "#fff", margin: "0 0 7px" }}>
            Create your organizer account
          </h1>
          <p style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 22px" }}>
            Tell us about your organization. The Pyramid team reviews every request before you can submit events.
          </p>

          {error && (
            <div style={{ marginBottom: 18, borderRadius: 11, border: "1px solid rgba(255,90,90,.32)", background: "rgba(255,90,90,.08)", padding: "11px 14px", font: "500 13px/1.4 Inter, sans-serif", color: "#FF9B9B" }}>
              {error}
            </div>
          )}

          <form action={createOrganizer} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label htmlFor="organizationName" style={labelStyle}>ORGANIZATION NAME *</label>
              <input id="organizationName" name="organizationName" required placeholder="Acme Startups" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="contactName" style={labelStyle}>YOUR NAME *</label>
              <input id="contactName" name="contactName" required placeholder="Jane Doe" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="contactEmail" style={labelStyle}>EMAIL *</label>
              <input id="contactEmail" name="contactEmail" type="email" autoComplete="email" required placeholder="you@acme.com" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="password" style={labelStyle}>PASSWORD *</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} placeholder="At least 6 characters" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="phone" style={labelStyle}>PHONE</label>
                <input id="phone" name="phone" placeholder="+355 …" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="website" style={labelStyle}>WEBSITE</label>
                <input id="website" name="website" type="url" placeholder="https://…" style={inputStyle} />
              </div>
            </div>
            <div>
              <label htmlFor="organizationDescription" style={labelStyle}>ABOUT YOUR ORGANIZATION</label>
              <textarea id="organizationDescription" name="organizationDescription" rows={2} placeholder="What does your organization do?" style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label htmlFor="reasonForAccess" style={labelStyle}>WHAT DO YOU WANT TO HOST?</label>
              <textarea id="reasonForAccess" name="reasonForAccess" rows={2} placeholder="e.g. a startup conference for ~180 guests next month" style={{ ...inputStyle, resize: "vertical" }} />
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
              Request organizer access
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <Link href="/login" style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", textDecoration: "none" }}>
            Already have an account? Sign in →
          </Link>
        </div>
      </div>
    </main>
  );
}
