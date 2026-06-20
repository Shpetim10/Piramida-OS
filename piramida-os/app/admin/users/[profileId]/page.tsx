import { use } from "react";
import Link from "next/link";
import { StaffForm } from "@/components/admin/StaffForm";
import { findStaff } from "@/lib/admin/data";

export default function EditStaffPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const member = findStaff(profileId);

  if (!member) {
    return (
      <div style={{ padding: "26px 42px 80px" }}>
        <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, background: "#151821", padding: 24, maxWidth: 520 }}>
          <div style={{ font: "700 15px Inter, sans-serif", color: "#fff", marginBottom: 6 }}>Staff member not found</div>
          <p style={{ font: "400 13px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 16px" }}>
            No staff account matches <code style={{ color: "#fff" }}>{profileId}</code>.
          </p>
          <Link href="/admin/users" style={{ display: "inline-flex", padding: "10px 16px", borderRadius: 10, background: "#D6FF00", color: "#0D0D12", font: "700 13px Inter, sans-serif", textDecoration: "none" }}>
            Back to staff
          </Link>
        </div>
      </div>
    );
  }

  return <StaffForm mode="edit" initialName={member.name} initialEmail={member.email} initialRole={member.role} />;
}
