"use client";

import { useViewport } from "@/lib/useViewport";

export function useAdminViewport() {
  const { vw } = useViewport();
  return { vw, isMobile: vw < 980, isNarrow: vw < 720 };
}

export function AdminScreen({ children }: { children: React.ReactNode }) {
  const { isMobile } = useAdminViewport();
  return <div style={{ padding: isMobile ? "18px 18px 70px" : "26px 42px 80px" }}>{children}</div>;
}
