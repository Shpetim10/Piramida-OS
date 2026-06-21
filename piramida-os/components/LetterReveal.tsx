"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export interface LetterSegment {
  text: string;
  color?: string;
}

/**
 * Reveals a headline letter-by-letter (each character fades + rises with an
 * incremental delay) the first time it scrolls into view. Words stay intact
 * (they wrap as whole words; characters animate individually).
 */
export function LetterReveal({
  segments,
  charDelay = 0.028,
  className,
  style,
}: {
  segments: LetterSegment[];
  charDelay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.4, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Flatten segments → words (keeping each word's colour), preserving order.
  const words = segments.flatMap((seg, si) =>
    seg.text
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w, wi) => ({ w, color: seg.color, key: `${si}-${wi}` }))
  );

  let gi = 0; // global char index → staggered delay
  const nodes: ReactNode[] = [];
  words.forEach((word, idx) => {
    if (idx > 0) nodes.push(" "); // breakable space between words
    nodes.push(
      <span key={word.key} style={{ display: "inline-block", whiteSpace: "nowrap", color: word.color }}>
        {Array.from(word.w).map((ch, ci) => {
          const d = gi++;
          return (
            <span
              key={ci}
              style={{
                display: "inline-block",
                opacity: shown ? 1 : 0,
                transform: shown ? "none" : "translateY(.5em)",
                transition: `opacity .42s ease ${d * charDelay}s, transform .42s ease ${d * charDelay}s`,
                willChange: "opacity, transform",
              }}
            >
              {ch}
            </span>
          );
        })}
      </span>
    );
  });

  return (
    <span ref={ref} className={className} style={style}>
      {nodes}
    </span>
  );
}
