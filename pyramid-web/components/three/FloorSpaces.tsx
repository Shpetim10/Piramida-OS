"use client";

import { useState } from "react";
import { RoundedBox, Html } from "@react-three/drei";
import { getFloor, type EventSpace } from "@/lib/pyramid-data";
import { usePyramid } from "@/lib/store";

const ATRIUM_R = 1.5; // open central atrium radius
const HALL_INNER = 1.7; // where radial halls start (just outside the atrium)

/** orient a child whose local +z points outward to world direction α (deg). */
const faceRotY = (angleDeg: number) => Math.PI / 2 - (angleDeg * Math.PI) / 180;

/** App-style radial layer of colour-coded tenant cubes for the selected floor. */
export function FloorSpaces({ floorId }: { floorId: number | "park" }) {
  const floor = getFloor(floorId);
  const selectSpace = usePyramid((s) => s.selectSpace);
  if (!floor) return null;

  return (
    <group>
      {/* base disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[7.2, 64]} />
        <meshStandardMaterial color="#eef1f5" />
      </mesh>

      {/* central OPEN circular atrium + ring walkway + railing */}
      <Atrium accent={floor.color} sunken={floorId === -1} />

      {/* radial halls/corridors out to each room */}
      {floor.spaces.map((s) => (
        <Hall key={`hall-${s.id}`} angle={s.angle} reach={s.radius} />
      ))}

      {floor.spaces.map((space) =>
        space.stairs ? (
          <StairsSpace key={space.id} space={space} onSelect={() => selectSpace(space.id)} />
        ) : (
          <SpaceCube key={space.id} space={space} onSelect={() => selectSpace(space.id)} />
        ),
      )}
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
function StairsSpace({ space, onSelect }: { space: EventSpace; onSelect: () => void }) {
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
    </group>
  );
}

/** A realistic solid tenant block, sitting flat on the floor (no float/glow). */
function SpaceCube({ space, onSelect }: { space: EventSpace; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const rad = (space.angle * Math.PI) / 180;
  const x = Math.cos(rad) * space.radius;
  const z = Math.sin(rad) * space.radius;
  const bookable = !!space.eventable;

  return (
    <group position={[x, space.size[1] / 2, z]} rotation={[0, faceRotY(space.angle), 0]}>
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
    </group>
  );
}
