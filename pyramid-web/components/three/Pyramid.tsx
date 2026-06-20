"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { FLOORS, usePyramid } from "@/lib/store";
import { PARK_BLOCK_COLORS } from "@/lib/pyramid-data";

// ---------------------------------------------------------------------------
// Exterior of the renovated Pyramid of Tirana (MVRDV, 2023).
//
// The real building is NOT a stack of square boxes — it is a faceted, roughly
// OCTAGONAL/star mass that tapers to an apex, with four diagonal concrete
// "beams" carrying the wide climbable staircases the public walks up, and
// sloped glazing filling the cardinal faces between the beams.
//
// We model it as octagonal terraces (an 8-gon prism per level) that shrink
// toward the top. On the four DIAGONAL faces sit the climbable ramps; on the
// four CARDINAL faces sit the sloped glass panels.
// ---------------------------------------------------------------------------

const LEVELS = 6;
const BASE = 11; // vertex diameter at the base
const STEP = 1.45; // terrace height
const SHRINK = 1.55; // diameter lost per level
const FACE_ROT = Math.PI / 8; // rotate the 8-gon so flat faces point at 45° multiples

const RAMP_DIRS = [45, 135, 225, 315].map((d) => (d * Math.PI) / 180); // diagonal beams
const GLASS_DIRS = [0, 90, 180, 270].map((d) => (d * Math.PI) / 180); // cardinal faces

const apothem = (R: number) => R * Math.cos(Math.PI / 8); // centre→flat-face distance
/** orient a child built along +z(outward)/+x(tangential)/+y(up) to world direction α */
const faceRot = (alpha: number): [number, number, number] => [0, Math.PI / 2 - alpha, 0];

export function Pyramid({ interactive = true }: { interactive?: boolean }) {
  const group = useRef<Group>(null);
  const { floorId, selectFloor } = usePyramid();
  const view = usePyramid((s) => s.view);

  useFrame((_, dt) => {
    if (group.current && view === "exterior") group.current.rotation.y += dt * 0.07;
  });

  const terraces = useMemo(
    () =>
      Array.from({ length: LEVELS }, (_, i) => {
        const R = (BASE - i * SHRINK) / 2;
        const a = apothem(R);
        return { i, R, a, yBottom: i * STEP, yTop: (i + 1) * STEP };
      }),
    [],
  );

  const activeTerrace = FLOORS.find((f) => f.id === floorId)?.terrace;

  return (
    <group ref={group}>
      {terraces.map((t) => {
        const floor = FLOORS.find((f) => f.terrace === t.i);
        const active = activeTerrace === t.i;
        const next = terraces[t.i + 1];

        return (
          <group key={t.i}>
            {/* faceted octagonal terrace mass */}
            <mesh
              position={[0, t.yBottom + STEP / 2, 0]}
              rotation={[0, FACE_ROT, 0]}
              castShadow
              receiveShadow
              onClick={(e) => {
                if (!interactive || !floor) return;
                e.stopPropagation();
                selectFloor(floor.id);
              }}
              onPointerOver={(e) => interactive && floor && (e.stopPropagation(), (document.body.style.cursor = "pointer"))}
              onPointerOut={() => (document.body.style.cursor = "auto")}
            >
              <cylinderGeometry args={[t.R, t.R, STEP, 8]} />
              <meshStandardMaterial
                color={active ? floor?.color ?? "#ffffff" : "#eef1f4"}
                emissive={active ? floor?.color ?? "#000000" : "#000000"}
                emissiveIntensity={active ? 0.32 : 0}
                roughness={0.85}
                metalness={0.05}
              />
            </mesh>

            {next && (
              <>
                {/* climbable stair-ramps up the four diagonal concrete beams */}
                {RAMP_DIRS.map((alpha, k) => (
                  <group key={`r${k}`} rotation={faceRot(alpha)}>
                    <StairRamp aOuter={t.a} aInner={next.a} baseY={t.yTop} width={2 * t.R * Math.sin(Math.PI / 8) * 0.78} />
                  </group>
                ))}
                {/* sloped glazing on the four cardinal faces between the beams */}
                {GLASS_DIRS.map((alpha, k) => (
                  <group key={`g${k}`} rotation={faceRot(alpha)}>
                    <GlassPanel aOuter={t.a} aInner={next.a} baseY={t.yTop} width={2 * t.R * Math.sin(Math.PI / 8) * 0.82} />
                  </group>
                ))}
              </>
            )}

            {/* colourful 2026 box-studios scattered on the lower exterior steps */}
            {t.i < 3 && <ParkBlocks a={t.a} topY={t.yTop} seed={t.i} />}

            {interactive && floor && view === "exterior" && (
              <Html position={[t.a + 0.25, t.yBottom + STEP / 2, 0]} center distanceFactor={18} occlude>
                <button className="terrace-tag" onClick={() => selectFloor(floor.id)} style={{ borderColor: floor.color }}>
                  {floor.label}
                </button>
              </Html>
            )}
          </group>
        );
      })}

      {/* glass apex */}
      <mesh position={[0, LEVELS * STEP + 0.5, 0]} rotation={[0, FACE_ROT, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.4, 1.1, 8]} />
        <meshStandardMaterial color="#bfe3ff" transparent opacity={0.6} roughness={0.1} metalness={0.3} />
      </mesh>

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color="#d7dde4" />
      </mesh>
    </group>
  );
}

/**
 * A flight of climbable steps bridging one terrace's top up to the next
 * (narrower) terrace. Built in a local frame where +z points OUTWARD and +y is
 * up: steps ascend as they move INWARD (toward the centre/apex) — the correct
 * climbing direction up the pyramid.
 */
function StairRamp({ aOuter, aInner, baseY, width }: { aOuter: number; aInner: number; baseY: number; width: number }) {
  const steps = 6;
  const tread = (aOuter - aInner) / steps;
  return (
    <group>
      {Array.from({ length: steps }, (_, s) => {
        const frac = (s + 0.5) / steps;
        const r = aOuter - (aOuter - aInner) * frac; // inward as we climb
        const y = baseY + STEP * frac; // upward as we climb
        return (
          <mesh key={s} position={[0, y, r]} castShadow receiveShadow>
            <boxGeometry args={[width, (STEP / steps) * 1.3, tread + 0.05]} />
            <meshStandardMaterial color="#f6f8fa" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * A sloped glazing panel bridging one terrace's top edge up to the next, built
 * in the same local frame (+z outward, +y up).
 */
function GlassPanel({ aOuter, aInner, baseY, width }: { aOuter: number; aInner: number; baseY: number; width: number }) {
  const dr = aInner - aOuter; // setback toward centre (negative)
  const dy = STEP;
  const L = Math.hypot(dr, dy);
  const midR = (aOuter + aInner) / 2;
  const midY = baseY + dy / 2;
  const tilt = Math.atan2(dr, dy); // align local +Y with the slope
  return (
    <mesh position={[0, midY, midR]} rotation={[tilt, 0, 0]} castShadow>
      <boxGeometry args={[width, L, 0.05]} />
      <meshStandardMaterial color="#bfe3ff" transparent opacity={0.5} roughness={0.1} metalness={0.35} />
    </mesh>
  );
}

/**
 * Small, colourful cube-like studio/seating blocks (the playful 2026 boxes the
 * renovation scattered on the slopes), placed on a terrace's top surface around
 * the perimeter. Deterministic positions so they stay put each frame.
 */
function ParkBlocks({ a, topY, seed }: { a: number; topY: number; seed: number }) {
  const blocks = useMemo(() => {
    const dirs = 8;
    return Array.from({ length: dirs }, (_, k) => {
      const alpha = ((k + (seed % 2) * 0.5) / dirs) * Math.PI * 2;
      const r = a - 0.45 - ((k + seed) % 2) * 0.3; // sit just inside the edge, staggered
      const x = Math.cos(alpha) * r;
      const z = Math.sin(alpha) * r;
      const s = 0.34 + ((k * 5 + seed * 3) % 3) * 0.07;
      const color = PARK_BLOCK_COLORS[(k + seed) % PARK_BLOCK_COLORS.length];
      return { x, z, s, color, key: k };
    });
  }, [a, seed, topY]);

  return (
    <>
      {blocks.map((b) => (
        <mesh key={b.key} position={[b.x, topY + b.s / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.s, b.s, b.s]} />
          <meshStandardMaterial color={b.color} roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
    </>
  );
}
