import { redirect } from "next/navigation";
import { EventsView } from "@/components/organizer/EventsView";
import { getOrganizerContext, getOrganizerEvents } from "@/lib/organizer/portal-data";

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const ctx = await getOrganizerContext();
  if (!ctx) redirect("/login");
  const events = await getOrganizerEvents(ctx);
  return <EventsView events={events} />;
}
