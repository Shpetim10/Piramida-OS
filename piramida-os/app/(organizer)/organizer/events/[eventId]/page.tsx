import { redirect } from "next/navigation";
import { OrganizerEventManagement } from "@/components/organizer/EventManagement";
import { getOrganizerContext } from "@/lib/organizer/portal-data";
import { getOrganizerEventSummary } from "@/lib/organizer/event-management";
import { AuthError } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function OrganizerEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getOrganizerContext();
  if (!ctx) redirect("/login");

  const { eventId } = await params;
  const { tab } = await searchParams;

  let event;
  try {
    event = await getOrganizerEventSummary(eventId);
  } catch (err) {
    if (err instanceof AuthError && err.status === 404) redirect("/organizer/events");
    if (err instanceof AuthError && err.status === 403) redirect("/organizer/events");
    throw err;
  }

  return (
    <OrganizerEventManagement
      event={event}
      activeTab={tab ?? "details"}
      identity={{ name: ctx.name, org: ctx.org, initials: ctx.initials }}
    />
  );
}
