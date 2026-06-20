import { redirect } from "next/navigation";
import { DashboardView } from "@/components/organizer/DashboardView";
import { getOrganizerContext, getOrganizerDashboard } from "@/lib/organizer/portal-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getOrganizerContext();
  if (!ctx) redirect("/login");
  const data = await getOrganizerDashboard(ctx);
  return <DashboardView name={ctx.name} {...data} />;
}
