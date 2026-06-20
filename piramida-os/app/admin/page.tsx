import { redirect } from "next/navigation";

// Admin landing → the organizer approval queue (the default Control Center screen).
export default function AdminPage() {
  redirect("/admin/organizer-approvals");
}
