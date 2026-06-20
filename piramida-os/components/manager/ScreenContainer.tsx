"use client";

import { useViewport } from "@/lib/useViewport";

// Applies the Manager Command Center's responsive screen padding (padX in the
// original design). Use the hook when a page needs the breakpoints too.
export function useMgrViewport() {
  const { vw } = useViewport();
  return { vw, isMobile: vw < 980, isNarrow: vw < 720 };
}

export function ScreenContainer({ children }: { children: React.ReactNode }) {
  const { isMobile } = useMgrViewport();
  return <div style={{ padding: isMobile ? "18px 18px 70px" : "26px 42px 80px" }}>{children}</div>;
}
