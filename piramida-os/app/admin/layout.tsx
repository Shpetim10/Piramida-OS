import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth/page-guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage("/admin");
  return <AdminShell>{children}</AdminShell>;
}
