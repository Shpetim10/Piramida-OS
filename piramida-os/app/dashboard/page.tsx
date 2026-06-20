import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentProfile } from "@/lib/auth/guards";
import { DEMO_COOKIE } from "@/lib/demo/personas";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  const c = await cookies();
  c.delete(DEMO_COOKIE);
  redirect("/login");
}

function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "amber" | "red" | "green" }) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-800 text-zinc-300",
    amber: "bg-amber-500/15 text-amber-300",
    red: "bg-red-500/15 text-red-300",
    green: "bg-emerald-500/15 text-emerald-300",
  };
  return <span className={`rounded px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

const severityTone = (s: string) => (s === "CRITICAL" || s === "HIGH" ? "red" : s === "MEDIUM" ? "amber" : "zinc");

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const me = await prisma.profile.findUnique({
    where: { id: profile.id },
    select: { fullName: true, email: true },
  });

  const isStaff = profile.type === ProfileType.STAFF;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900 px-8 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Pyramid OS · Launch Control</p>
          <h1 className="text-lg font-semibold">{isStaff ? "Staff Command Center" : "Organizer Portal"}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-400">
            {me?.fullName} · {profile.roleCodes.join(", ") || profile.type}
          </span>
          <form action={logout}>
            <button className="rounded border border-zinc-800 px-3 py-1.5 hover:border-zinc-600">Sign out</button>
          </form>
        </div>
      </header>

      <div className="px-8 py-6">
        {isStaff ? <StaffView orgId={profile.orgId} /> : <OrganizerView contactId={profile.contactId} />}
      </div>
    </main>
  );
}

async function StaffView({ orgId }: { orgId: string }) {
  const [events, conflicts, requests] = await Promise.all([
    prisma.event.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, title: true, status: true, approvalStatus: true, expectedGuests: true, eventStart: true },
      take: 10,
    }),
    prisma.conflict.findMany({
      where: { orgId, status: { in: ["OPEN", "AUTO_FIXED"] } },
      orderBy: { severity: "desc" },
      select: { id: true, title: true, type: true, severity: true, status: true },
      take: 10,
    }),
    prisma.eventRequest.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, approvalStatus: true, confidence: true },
      take: 10,
    }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2 rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Events</h2>
        {events.length === 0 ? (
          <Empty>No events yet.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-zinc-500">
                    {e.code} · {e.expectedGuests ?? "?"} guests
                    {e.eventStart ? ` · ${e.eventStart.toISOString().slice(0, 10)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge tone="amber">{e.status}</Badge>
                  <Badge tone={e.approvalStatus === "APPROVED" ? "green" : "zinc"}>{e.approvalStatus}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Open Conflicts</h2>
        {conflicts.length === 0 ? (
          <Empty>No open conflicts. GO.</Empty>
        ) : (
          <ul className="space-y-2">
            {conflicts.map((c) => (
              <li key={c.id} className="rounded-lg border border-zinc-800 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{c.title}</p>
                  <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {c.type} · {c.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lg:col-span-3 rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Event Requests</h2>
        {requests.length === 0 ? (
          <Empty>No requests.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <p className="font-medium">{r.title ?? "Untitled request"}</p>
                <div className="flex items-center gap-2">
                  {r.confidence != null && (
                    <span className="text-xs text-zinc-500">{Math.round(r.confidence * 100)}% confidence</span>
                  )}
                  <Badge tone="amber">{r.status}</Badge>
                  <Badge tone={r.approvalStatus === "APPROVED" ? "green" : "zinc"}>{r.approvalStatus}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function OrganizerView({ contactId }: { contactId: string | null }) {
  if (!contactId) return <Empty>Your organizer profile is not linked to a contact yet.</Empty>;

  const [requests, proposals] = await Promise.all([
    prisma.eventRequest.findMany({
      where: { contactId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, approvalStatus: true },
    }),
    prisma.proposal.findMany({
      where: { sharedWithContactId: contactId, sentAt: { not: null }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true },
    }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">My Event Requests</h2>
        {requests.length === 0 ? (
          <Empty>You have not submitted a request yet.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <p className="font-medium">{r.title ?? "Untitled request"}</p>
                <Badge tone="amber">{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Shared Proposals</h2>
        {proposals.length === 0 ? (
          <Empty>No proposals shared with you yet.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {proposals.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <p className="font-medium">{p.title}</p>
                <Badge tone="green">{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}
