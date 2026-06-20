import { GuestShell } from "@/components/guest/GuestShell";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuestShell>{children}</GuestShell>;
}
