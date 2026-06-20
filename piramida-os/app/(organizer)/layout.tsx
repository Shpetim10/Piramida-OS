import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { requireOrganizerPage } from "@/lib/auth/page-guards";
import { getOrganizerContext } from "@/lib/organizer/portal-data";

export const dynamic = "force-dynamic";

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrganizerPage("/organizer");
  const ctx = await getOrganizerContext();
  const identity = ctx
    ? { name: ctx.name, org: ctx.org, initials: ctx.initials }
    : undefined;
  return <OrganizerShell identity={identity}>{children}</OrganizerShell>;
}
