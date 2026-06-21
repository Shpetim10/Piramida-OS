"use client";

import { RoundedBox } from "@react-three/drei";
import type { Layout } from "@/lib/pyramid-data";

// ---------------------------------------------------------------------------
// Primitive furniture pieces
// ---------------------------------------------------------------------------

export function Chair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* seat */}
      <RoundedBox args={[0.4, 0.08, 0.4]} radius={0.03} position={[0, 0.24, 0]} castShadow>
        <meshStandardMaterial color="#2b3a55" />
      </RoundedBox>
      {/* back — sits behind the sitter (+z) so the chair faces -z toward the
          stage in theater/classroom, and faces inward toward the table in banquet */}
      <RoundedBox args={[0.4, 0.4, 0.07]} radius={0.03} position={[0, 0.44, 0.17]} rotation={[-0.08, 0, 0]} castShadow>
        <meshStandardMaterial color="#34465f" />
      </RoundedBox>
      {/* legs */}
      {[
        [-0.16, 0.12, -0.16],
        [0.16, 0.12, -0.16],
        [-0.16, 0.12, 0.16],
        [0.16, 0.12, 0.16],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.24, 6]} />
          <meshStandardMaterial color="#1c2738" />
        </mesh>
      ))}
    </group>
  );
}

export function RoundTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.06, 24]} />
        <meshStandardMaterial color="#e8e2d6" />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
        <meshStandardMaterial color="#b8b0a0" />
      </mesh>
    </group>
  );
}

export function Stage({ width = 4, z = -3.4 }: { width?: number; z?: number }) {
  return (
    <group position={[0, 0, z]}>
      <RoundedBox args={[width, 0.3, 1.4]} radius={0.05} position={[0, 0.15, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#1a1f2b" />
      </RoundedBox>
      {/* screen */}
      <mesh position={[0, 1.4, -0.6]}>
        <planeGeometry args={[width * 0.8, 1.8]} />
        <meshStandardMaterial color="#0d1b2a" emissive="#16324f" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Layout solvers — return chair (and table) positions for a given count.
// Pure functions: change `chairs` and the arrangement recomputes.
// ---------------------------------------------------------------------------

export interface Placed {
  position: [number, number, number];
  rotation: number;
}

function theater(chairs: number): Placed[] {
  if (chairs <= 0) return [];
  const cols = Math.min(Math.ceil(Math.sqrt(chairs * 1.7)), 14);
  const aisle = Math.floor(cols / 2);
  const seatGap = 0.62;
  const rowGap = 0.78;
  const out: Placed[] = [];
  let placed = 0;
  let row = 0;
  while (placed < chairs) {
    const inThisRow = Math.min(cols, chairs - placed);
    const rowWidth = (cols - 1) * seatGap + 0.5; // include aisle gap
    for (let c = 0; c < inThisRow; c++) {
      const aisleShift = c >= aisle ? 0.5 : 0;
      const x = -rowWidth / 2 + c * seatGap + aisleShift;
      const z = -1.6 + row * rowGap;
      out.push({ position: [x, 0, z], rotation: 0 }); // facing -z stage
      placed++;
    }
    row++;
  }
  return out;
}

function classroom(chairs: number): Placed[] {
  // chairs paired behind desks, wider aisle, same facing
  return theater(chairs).map((p) => ({ ...p, position: [p.position[0] * 1.15, 0, p.position[2] * 1.1] }));
}

function banquet(chairs: number, tables: number): { chairs: Placed[]; tables: [number, number, number][] } {
  const t = Math.max(tables, Math.ceil(chairs / 8));
  const perTable = Math.ceil(chairs / t);
  const cols = Math.ceil(Math.sqrt(t));
  const rows = Math.ceil(t / cols);
  const spacing = 2.4;
  const tablePos: [number, number, number][] = [];
  const chairPos: Placed[] = [];
  let remaining = chairs;
  let made = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (made >= t) break;
      const tx = (c - (cols - 1) / 2) * spacing;
      const tz = (r - (rows - 1) / 2) * spacing;
      tablePos.push([tx, 0, tz]);
      const seats = Math.min(perTable, remaining);
      for (let s = 0; s < seats; s++) {
        const a = (s / seats) * Math.PI * 2;
        chairPos.push({
          position: [tx + Math.cos(a) * 1.0, 0, tz + Math.sin(a) * 1.0],
          rotation: -a + Math.PI / 2,
        });
      }
      remaining -= seats;
      made++;
    }
  }
  return { chairs: chairPos, tables: tablePos };
}

export function solveLayout(layout: Layout, chairs: number, tables = 0) {
  switch (layout) {
    case "theater":
      return { chairs: theater(chairs), tables: [] as [number, number, number][] };
    case "classroom":
      return { chairs: classroom(chairs), tables: [] as [number, number, number][] };
    case "banquet":
      return banquet(chairs, tables);
    case "standing":
    default:
      return { chairs: [] as Placed[], tables: [] as [number, number, number][] };
  }
}
