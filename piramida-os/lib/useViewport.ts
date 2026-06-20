"use client";

import { useEffect, useState } from "react";

// Initialized to a desktop width so server render and first client render match
// (avoids hydration mismatch); the real width is applied after mount.
export function useViewport() {
  const [vw, setVw] = useState(1280);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return { vw, isMobile: vw < 900, isNarrow: vw < 760 };
}
