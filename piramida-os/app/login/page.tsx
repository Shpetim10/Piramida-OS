import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DEMO_PERSONAS, DEMO_COOKIE } from "@/lib/demo/personas";

export const dynamic = "force-dynamic";

async function loginAs(formData: FormData) {
  "use server";
  const profileId = String(formData.get("profileId"));
  const next = String(formData.get("next") || "/dashboard");
  const valid = DEMO_PERSONAS.some((p) => p.profileId === profileId);
  if (!valid) return;
  const c = await cookies();
  c.set(DEMO_COOKIE, profileId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/") ? next : "/dashboard";
  const demoMode = process.env.DEMO_MODE === "true";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400 mb-2">Pyramid OS · Launch Control</p>
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-zinc-400 mb-6">
          {demoMode
            ? "Demo mode: pick a seeded persona to explore the system with real data."
            : "Demo mode is off — wire Supabase Auth to sign in."}
        </p>

        {next && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Sign in to continue to <span className="font-mono text-xs">{nextPath}</span>
          </div>
        )}

        {demoMode && (
          <div className="space-y-2">
            {DEMO_PERSONAS.map((p) => (
              <form key={p.profileId} action={loginAs}>
                <input type="hidden" name="profileId" value={p.profileId} />
                <input type="hidden" name="next" value={nextPath} />
                <button
                  type="submit"
                  className="w-full flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-left hover:border-amber-500/60 hover:bg-zinc-800 transition"
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs rounded bg-zinc-800 px-2 py-1 text-amber-300">{p.role}</span>
                </button>
              </form>
            ))}
          </div>
        )}

        <div className="mt-8 text-sm text-zinc-500">
          <Link href="/events" className="underline hover:text-zinc-300">
            View public events →
          </Link>
        </div>
      </div>
    </main>
  );
}
