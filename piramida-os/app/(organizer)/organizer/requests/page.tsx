import { redirect } from "next/navigation";
import { RequestsView } from "@/components/organizer/RequestsView";
import { getOrganizerContext, getOrganizerRequests } from "@/lib/organizer/portal-data";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const ctx = await getOrganizerContext();
  if (!ctx) redirect("/login");
  const requests = await getOrganizerRequests(ctx);
  return <RequestsView requests={requests} />;
}
