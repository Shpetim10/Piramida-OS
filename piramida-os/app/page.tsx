import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Pyramid of Tirana</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Pyramid OS</h1>
        <p className="mt-3 text-zinc-400">
          Event launch-control. Other platforms book rooms — Pyramid OS launches experiences.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-zinc-950 hover:bg-amber-400"
          >
            Staff / Organizer sign in
          </Link>
          <Link
            href="/events"
            className="rounded-lg border border-zinc-800 px-5 py-2.5 font-medium hover:border-zinc-600"
          >
            Public events
          </Link>
        </div>
      </div>
    </main>
  );
}
