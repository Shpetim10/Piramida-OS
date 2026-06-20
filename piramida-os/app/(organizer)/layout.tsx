import { OrganizerShell } from "@/components/organizer/OrganizerShell";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrganizerShell>{children}</OrganizerShell>;
}
