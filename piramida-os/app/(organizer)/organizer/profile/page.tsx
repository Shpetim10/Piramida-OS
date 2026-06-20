import { redirect } from "next/navigation";
import { ProfileView } from "@/components/organizer/ProfileView";
import { getOrganizerContext, getOrganizerProfileData } from "@/lib/organizer/portal-data";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await getOrganizerContext();
  if (!ctx) redirect("/login");
  const data = await getOrganizerProfileData(ctx);
  return <ProfileView {...data} />;
}
