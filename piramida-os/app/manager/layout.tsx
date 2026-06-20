import { ManagerShell } from "@/components/manager/ManagerShell";
import { requireStaffPage } from "@/lib/auth/page-guards";

export const dynamic = "force-dynamic";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage("/manager");
  return <ManagerShell>{children}</ManagerShell>;
}
