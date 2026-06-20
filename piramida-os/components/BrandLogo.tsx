import Image from "next/image";
import type { CSSProperties } from "react";

// Pyramid OS brand art (transparent PNGs in /public, derived from PyramidOS.jpeg):
//   • pyramid-os-mark.png — the lime sunburst-pyramid mark only (≈256×115)
//   • pyramid-os-logo.png — full lockup: mark above the "PYRAMID-OS" wordmark (720×401)

const MARK_RATIO = 256 / 115;
const LOGO_RATIO = 720 / 401;

/** The mark only — sized by height. Drop-in replacement for the old inline
 *  triangle icon used in the shell headers/sidebars. */
export function BrandMark({
  height = 30,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Image
      src="/pyramid-os-mark.png"
      alt="Pyramid OS"
      width={Math.round(height * MARK_RATIO)}
      height={height}
      priority
      className={className}
      style={style}
    />
  );
}

/** The full lockup (mark + "PYRAMID-OS" wordmark) — sized by height. Used where
 *  the logo stands on its own, e.g. the login screen. */
export function BrandLogo({
  height = 96,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Image
      src="/pyramid-os-logo.png"
      alt="Pyramid OS"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      priority
      className={className}
      style={style}
    />
  );
}
