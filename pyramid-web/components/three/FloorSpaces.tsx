"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Html } from "@react-three/drei";
import { Group } from "three";
import { getFloor, type EventSpace } from "@/lib/pyramid-data";
import { usePyramid } from "@/lib/store";

const ATRIUM_R = 1.5; // open central atrium radius
const HALL_INNER = 1.7; // where radial halls start (just outside the atrium)
const STORY = 1.7; // vertical lift of the upper tier on dense floors
const DENSE_FLOOR = 8; // floors with more spaces than this get a two-story layout

/** orient a child whose local +z points outward to world direction α (deg). */
const faceRotY = (angleDeg: number) => Math.PI / 2 - (angleDeg * Math.PI) / 180;

const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Staggered "assembly" entrance: each block springs up from the floor in turn. */
function Rise({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  const t = useRef(0);
  const DUR = 0.5;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g || t.current >= delay + DUR) return;
    t.current += dt;
    const p = Math.max(0, Math.min(1, (t.current - delay) / DUR));
    g.scale.setScalar(Math.max(0.0001, easeOutBack(p)));
    g.position.y = (1 - p) * -0.7;
  });
  return (
    <group ref={ref} scale={0.0001} position={[0, -0.7, 0]}>
      {children}
    </group>
  );
}

/** App-style radial layer of colour-coded tenant cubes for the selected floor. */
export function FloorSpaces({ floorId }: { floorId: number | "park" }) {
  const floor = getFloor(floorId);
  const selectSpace = usePyramid((s) => s.selectSpace);
  if (!floor) return null;

  return (
    <group>
      {/* base disc — white-to-gray concrete interior floor (slightly enlarged) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[8.2, 64]} />
        <meshStandardMaterial color="#e3e7ed" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Pyramid OS lime accent rim around the floor plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[7.95, 8.15, 96]} />
        <meshStandardMaterial color="#d6ff00" emissive="#d6ff00" emissiveIntensity={0.6} transparent opacity={0.85} toneMapped={false} />
      </mesh>

      {/* central OPEN circular atrium + ring walkway + railing */}
      <Atrium accent={floor.color} sunken={floorId === -1} />

      {/* radial halls/corridors out to each room */}
      {floor.spaces.map((s) => (
        <Hall key={`hall-${s.id}`} angle={s.angle} reach={s.radius} />
      ))}

      {floor.spaces.map((space, i) => {
        // On dense floors, raise every other block onto an upper tier so the
        // ring reads as a two-story floor (skip the stairs + glass-front hub).
        const lifted =
          floor.spaces.length > DENSE_FLOOR && i % 2 === 1 && !space.stairs && !space.glassFront;
        return space.stairs ? (
          <StairsSpace key={space.id} space={space} index={i} onSelect={() => selectSpace(space.id)} />
        ) : (
          <SpaceCube key={space.id} space={space} index={i} lift={lifted ? STORY : 0} onSelect={() => selectSpace(space.id)} />
        );
      })}
    </group>
  );
}

/** Open circular atrium: a ring walkway floor with a thin railing around the void. */
function Atrium({ accent, sunken }: { accent: string; sunken: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]} receiveShadow>
        <ringGeometry args={[ATRIUM_R, ATRIUM_R + 0.9, 64]} />
        <meshStandardMaterial color="#dde2e9" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[ATRIUM_R - 0.06, ATRIUM_R, 64]} />
        <meshStandardMaterial color={accent} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[ATRIUM_R, 0.035, 8, 64]} />
        <meshStandardMaterial color="#b7c0cc" metalness={0.4} roughness={0.4} />
      </mesh>
      {sunken && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
          <circleGeometry args={[ATRIUM_R, 48]} />
          <meshStandardMaterial color="#c2cad6" />
        </mesh>
      )}
    </group>
  );
}

/** A subtle radial corridor strip from the atrium out toward a room. */
function Hall({ angle, reach }: { angle: number; reach: number }) {
  const length = Math.max(0.4, reach - HALL_INNER - 0.4);
  const centerR = HALL_INNER + length / 2;
  const rad = (angle * Math.PI) / 180;
  return (
    <group position={[Math.cos(rad) * centerR, 0.01, Math.sin(rad) * centerR]} rotation={[0, faceRotY(angle), 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[0.7, 0.02, length]} />
        <meshStandardMaterial color="#e2e6ec" />
      </mesh>
    </group>
  );
}

/** Floor-0 staircase space — a clean grey climbable flight; click to open the
 *  stair-talk (50 people, screen, no chairs). Modelled after the reference. */
function StairsSpace({ space, onSelect, index = 0 }: { space: EventSpace; onSelect: () => void; index?: number }) {
  const [hover, setHover] = useState(false);
  const rad = (space.angle * Math.PI) / 180;
  const x = Math.cos(rad) * space.radius;
  const z = Math.sin(rad) * space.radius;
  const steps = 7;
  const rise = 0.17;
  const tread = 0.3;
  const width = space.size[0];

  return (
    <group position={[x, 0, z]} rotation={[0, faceRotY(space.angle) + Math.PI, 0]}>
      <Rise delay={index * 0.05}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        {/* solid stepped staircase — each step a full column from the floor up */}
        {Array.from({ length: steps }, (_, s) => {
          const h = (s + 1) * rise; // grows toward the back
          const zs = ((steps - 1) / 2 - s) * tread; // front (low) → back (high)
          return (
            <mesh key={s} position={[0, h / 2, zs]} castShadow receiveShadow>
              <boxGeometry args={[width, h, tread]} />
              <meshStandardMaterial color={hover ? "#cdd3db" : "#bcc3cc"} roughness={0.95} metalness={0.04} />
            </mesh>
          );
        })}
      </group>

      <Html position={[0, rise * steps + 0.5, 0]} center distanceFactor={14} occlude>
        <div className="space-pin has-event" onClick={onSelect}>
          <span className="space-pin-name">{space.name}</span>
          <span className="space-pin-dot" style={{ background: space.color }} />
        </div>
      </Html>
      </Rise>
    </group>
  );
}

/** A realistic solid tenant block. Sits flat on the floor, or — when `lift` is
 *  set — floats on an upper tier carried by slim columns (two-story floors). */
function SpaceCube({ space, onSelect, lift = 0, index = 0 }: { space: EventSpace; onSelect: () => void; lift?: number; index?: number }) {
  const [hover, setHover] = useState(false);
  const rad = (space.angle * Math.PI) / 180;
  const x = Math.cos(rad) * space.radius;
  const z = Math.sin(rad) * space.radius;
  const bookable = !!space.eventable;

  const [w, h, d] = space.size;
  // Local Y of the floor (world y = 0) relative to this group's centre.
  const floorLocalY = -(h / 2 + lift);
  const colX = w / 2 - 0.16;
  const colZ = d / 2 - 0.16;

  return (
    <group position={[x, space.size[1] / 2 + lift, z]} rotation={[0, faceRotY(space.angle), 0]}>
      <Rise delay={index * 0.05}>
      {lift > 0 && (
        <group>
          {/* slim support columns down to the floor */}
          {[
            [colX, colZ],
            [-colX, colZ],
            [colX, -colZ],
            [-colX, -colZ],
          ].map(([cx, cz], i) => (
            <mesh key={i} position={[cx, floorLocalY + lift / 2, cz]} castShadow>
              <boxGeometry args={[0.12, lift, 0.12]} />
              <meshStandardMaterial color="#aab2be" roughness={0.85} metalness={0.05} />
            </mesh>
          ))}
          {/* upper-floor plate carrying the block */}
          <mesh position={[0, -h / 2 - 0.05, 0]} receiveShadow castShadow>
            <boxGeometry args={[w * 1.08, 0.1, d * 1.08]} />
            <meshStandardMaterial color="#cfd4db" roughness={0.9} metalness={0.03} />
          </mesh>
        </group>
      )}

      <group
        onClick={(e) => {
          e.stopPropagation();
          if (bookable) onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = bookable ? "pointer" : "not-allowed";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <RoundedBox args={space.size} radius={0.06} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial
            color={bookable ? space.color : "#aeb6c0"}
            roughness={0.7}
            metalness={0.02}
            emissive={space.color}
            emissiveIntensity={bookable && hover ? 0.14 : 0}
          />
        </RoundedBox>

        {/* glazed entry facing the atrium (local -z faces the centre) */}
        {space.glassFront && (
          <mesh position={[0, -space.size[1] * 0.12, -space.size[2] / 2 - 0.02]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[space.size[0] * 0.6, space.size[1] * 0.62]} />
            <meshStandardMaterial color="#bfe3ff" transparent opacity={0.5} roughness={0.1} metalness={0.4} />
          </mesh>
        )}
      </group>

      <Html position={[0, space.size[1] / 2 + 0.55, 0]} center distanceFactor={14} occlude>
        <div className={`space-pin ${bookable ? "has-event" : "disabled"}`} onClick={() => bookable && onSelect()}>
          <span className="space-pin-name">{space.name}</span>
          {bookable ? (
            <span className="space-pin-dot" style={{ background: space.color }} />
          ) : (
            <span className="space-pin-lock">🔒</span>
          )}
        </div>
      </Html>
      </Rise>
    </group>
  );
}
