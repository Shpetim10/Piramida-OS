"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { StaffForm } from "@/components/admin/StaffForm";

interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  profileRoles: { role: { code: string; label: string } }[];
}

export default function EditStaffPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/staff/${profileId}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (d?.id) setProfile(d);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [profileId]);

  if (loading) {
    return (
      <div style={{ padding: "26px 42px 80px", font: "500 13px Inter, sans-serif", color: "#7D8799" }}>
        Loading…
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={{ padding: "26px 42px 80px" }}>
        <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, background: "#151821", padding: 24, maxWidth: 520 }}>
          <div style={{ font: "700 15px Inter, sans-serif", color: "#fff", marginBottom: 6 }}>Staff member not found</div>
          <p style={{ font: "400 13px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 16px" }}>
            No staff account matches <code style={{ color: "#fff" }}>{profileId}</code>.
          </p>
          <Link href="/admin/users" style={{ display: "inline-flex", padding: "10px 16px", borderRadius: 10, background: "#C8F000", color: "#0D0D12", font: "700 13px Inter, sans-serif", textDecoration: "none" }}>
            Back to staff
          </Link>
        </div>
      </div>
    );
  }

  const roleCode = profile.profileRoles[0]?.role?.code ?? "EVENT_MANAGER";

  return (
    <StaffForm
      mode="edit"
      profileId={profile.id}
      initialName={profile.fullName}
      initialEmail={profile.email}
      initialRole={roleCode}
    />
  );
}
