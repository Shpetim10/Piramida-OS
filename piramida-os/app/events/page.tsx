import Link from "next/link";
import { PublicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// Public listing — reads ONLY published, guest-safe publication fields.
export default async function PublicEventsPage() {
  const events = await prisma.eventPublication.findMany({
    where: { status: PublicationStatus.PUBLISHED, deletedAt: null },
    orderBy: { publicStart: "asc" },
    select: {
      slug: true,
      publicTitle: true,
      publicDescription: true,
      publicStart: true,
      venueLabel: true,
      capacityPublic: true,
      registrationOpen: true,
    },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-8 py-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Pyramid of Tirana</p>
        <h1 className="mb-8 text-3xl font-semibold">Public Events</h1>
        {events.length === 0 ? (
          <p className="text-zinc-500">No published events right now.</p>
        ) : (
          <ul className="space-y-4">
            {events.map((e) => (
              <li key={e.slug}>
                <Link
                  href={`/events/${e.slug}`}
                  className="block rounded-xl border border-zinc-900 bg-zinc-900/40 p-5 hover:border-amber-500/50"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium">{e.publicTitle}</h2>
                    {e.registrationOpen && (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                        Registration open
                      </span>
                    )}
                  </div>
                  {e.publicDescription && <p className="mt-1 text-sm text-zinc-400">{e.publicDescription}</p>}
                  <p className="mt-2 text-xs text-zinc-500">
                    {e.publicStart ? e.publicStart.toISOString().slice(0, 10) : "Date TBA"}
                    {e.venueLabel ? ` · ${e.venueLabel}` : ""}
                    {e.capacityPublic ? ` · capacity ${e.capacityPublic}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
