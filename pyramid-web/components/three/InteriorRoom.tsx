"use client";

import { useMemo } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import type { EventInfo } from "@/lib/pyramid-data";
import { Chair, RoundTable, Stage, solveLayout } from "./Furniture";

// ---------------------------------------------------------------------------
// STATIC ROOM SIZING + FIXED-SIZE FURNITURE (critical constraints)
//
// The room shell (floor + walls) is sized ONCE from the block's plan footprint —
// a fixed, static bounding box. Adding interior assets never mutates it.
//
// The furniture is also a FIXED size: chairs/tables are placed in local
// coordinates at 1:1 scale and are NEVER scaled to fit. Overflow is prevented
// upstream instead — each room declares min/max chair counts (see pyramid-data)
// and the editor clamps to them, so the furniture always fits the static shell.
// ---------------------------------------------------------------------------

const ROOM_SCALE = 3.4; // metres of interior room per unit of plan footprint
const MIN_W = 6;
const MIN_D = 7;

export function InteriorRoom({
  event,
  accent,
  footprint = [2, 2],
  stairs = false,
}: {
  event: EventInfo;
  accent: string;
  footprint?: [number, number];
  stairs?: boolean;
}) {
  // Static room shell: depends ONLY on the block footprint, never furniture.
  const span = useMemo(() => {
    const w = Math.max(MIN_W, footprint[0] * ROOM_SCALE);
    const d = Math.max(MIN_D, footprint[1] * ROOM_SCALE);
    return { w, d };
  }, [footprint]);

  // Furniture is computed independently, at a FIXED 1:1 size.
  const { chairs, tables } = useMemo(
    () => solveLayout(event.layout, event.chairs, event.tables ?? 0),
    [event.layout, event.chairs, event.tables],
  );

  const stageZ = -span.d / 2 + 0.9;

  return (
    <group>
      {/* ---- STATIC SHELL (fixed bounding box) ---- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[span.w, span.d]} />
        <meshStandardMaterial color="#cfd6e0" />
      </mesh>
      <mesh position={[0, 1.6, -span.d / 2]} receiveShadow>
        <boxGeometry args={[span.w, 3.2, 0.1]} />
        <meshStandardMaterial color="#eef2f7" />
      </mesh>
      <mesh position={[-span.w / 2, 1.6, 0]} receiveShadow>
        <boxGeometry args={[0.1, 3.2, span.d]} />
        <meshStandardMaterial color="#e3e8ef" transparent opacity={0.55} />
      </mesh>
      <mesh position={[span.w / 2, 1.6, 0]} receiveShadow>
        <boxGeometry args={[0.1, 3.2, span.d]} />
        <meshStandardMaterial color="#e3e8ef" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 2.9, -span.d / 2 + 0.06]}>
        <planeGeometry args={[span.w, 0.25]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} />
      </mesh>

      {stairs ? (
        // ---- Stair-talk: tiered seating on the steps + a screen, no chairs ----
        <StairSeating width={span.w} depth={span.d} />
      ) : (
        // ---- Fixed-size furniture (NOT scaled to fit) ----
        <group>
          {(event.layout === "theater" || event.layout === "classroom") && (
            <Stage width={Math.min(span.w * 0.7, 5)} z={stageZ} />
          )}
          {tables.map((p, i) => (
            <RoundTable key={`t${i}`} position={p} />
          ))}
          {chairs.map((c, i) => (
            <Chair key={`c${i}`} position={c.position} rotation={c.rotation} />
          ))}
        </group>
      )}

      <Text position={[0, 0.05, span.d / 2 - 0.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.4} color="#8893a5" anchorX="center">
        {stairs ? `STAIR TALK · ${event.seats ?? 50} ON STEPS` : `${event.layout.toUpperCase()} · ${event.chairs} seats`}
      </Text>
    </group>
  );
}

/** Tiered concrete seating-steps facing a presentation screen. */
function StairSeating({ width, depth }: { width: number; depth: number }) {
  const rows = 5;
  const rise = 0.32;
  const tread = 0.7;
  const seatW = Math.min(width * 0.82, 6);
  return (
    <group>
      {/* screen at the front */}
      <mesh position={[0, 1.5, -depth / 2 + 0.12]}>
        <planeGeometry args={[seatW * 0.7, 1.7]} />
        <meshStandardMaterial color="#0d1b2a" emissive="#16324f" emissiveIntensity={0.6} />
      </mesh>
      {/* tiered seating steps, rising toward the back */}
      {Array.from({ length: rows }, (_, r) => {
        const z = -depth / 2 + 1.4 + r * tread;
        const y = (r + 0.5) * rise;
        return (
          <RoundedBox key={r} args={[seatW, rise, tread]} radius={0.04} position={[0, y, z]} castShadow receiveShadow>
            <meshStandardMaterial color="#bcc3cc" roughness={0.95} metalness={0.04} />
          </RoundedBox>
        );
      })}
    </group>
  );
}
