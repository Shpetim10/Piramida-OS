import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthError, requirePublicPublication } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

interface AgendaRow {
  time?: string;
  title?: string;
  space?: string;
}

export default async function PublicEventDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let pub;
  try {
    pub = await requirePublicPublication(slug);
  } catch (e) {
    if (e instanceof AuthError) notFound();
    throw e;
  }

  const agenda = Array.isArray(pub.agenda) ? (pub.agenda as AgendaRow[]) : [];
  const map = (pub.publicMap ?? {}) as { route?: string[] };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-8 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/events" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← All events
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">{pub.publicTitle}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {pub.publicStart ? pub.publicStart.toISOString().slice(0, 10) : "Date TBA"}
          {pub.venueLabel ? ` · ${pub.venueLabel}` : ""}
        </p>
        {pub.publicDescription && <p className="mt-4 text-zinc-300">{pub.publicDescription}</p>}

        {pub.registrationOpen && (
          <div className="mt-6 rounded-lg border border-emerald-700/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Registration is open{pub.capacityPublic ? ` · ${pub.capacityPublic} seats` : ""}.
          </div>
        )}

        {agenda.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-400">Agenda</h2>
            <ul className="space-y-2">
              {agenda.map((row, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-zinc-900 bg-zinc-900/40 px-4 py-2.5">
                  <span className="w-14 shrink-0 text-sm text-amber-300">{row.time}</span>
                  <span className="flex-1 text-sm">{row.title}</span>
                  {row.space && <span className="text-xs text-zinc-500">{row.space}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {map.route && map.route.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-400">Getting around</h2>
            <p className="text-sm text-zinc-400">{map.route.join("  →  ")}</p>
          </section>
        )}
      </div>
    </main>
  );
}
