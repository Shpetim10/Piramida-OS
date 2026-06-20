"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { DoubleSide, Group, type Material, Mesh, Plane, Vector3 } from "three";
import type { Floor } from "@/lib/pyramid-data";
import { FLOORS, usePyramid } from "@/lib/store";
import { useProcessedModel } from "./PyramidModel";

// ---------------------------------------------------------------------------
// EXPLODED "SLICED PYRAMID" view (Toptani-style floor stack).
//
// We reuse the EXACT captured pyramid mesh from useProcessedModel() and cut it
// into one horizontal slab per building floor using THREE.Plane clipping — so
// every slice is the genuine pyramid cross-section at that level (wide base,
// narrowing apex). The slabs are then pulled apart vertically with a springy
// stagger. Each slab maps to a floor and selects it on click, like the terrace
// tags. The park floor is excluded; no OSM surroundings or grass here.
//
// `SlicedPyramidSlabs` is the SHARED renderer used by both:
//   • the full-screen exploded view (ExplodedPyramid, defaults → unchanged), and
//   • the compact mini side view shown when a floor is open (FloorSliceMini),
//     which passes `highlightFloorId` to make the current floor stand out.
// ---------------------------------------------------------------------------

const SLICES = 5; // building floors: -1, 0, 1, 2, 3
const SLAB_GAP = 1.1; // world units of separation added per level when exploded
const DUR = 0.6; // per-slab explode duration
const STAGGER = 0.06; // delay between slabs

const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export function SlicedPyramidSlabs({
  highlightFloorId = null,
  showTags = true,
  gap = SLAB_GAP,
}: {
  /** when set, this floor's slab is emphasized and the others fade back */
  highlightFloorId?: Floor["id"] | null;
  /** render the left-side floor-number tags (off for the compact mini view) */
  showTags?: boolean;
  /** vertical separation per level (defaults to the full-view value) */
  gap?: number;
}) {
  const gl = useThree((s) => s.gl);
  const selectFloor = usePyramid((s) => s.selectFloor);
  const { root, scale, offset, height } = useProcessedModel();

  // THREE.Plane clipping must be enabled on the renderer.
  useEffect(() => {
    const prev = gl.localClippingEnabled;
    gl.localClippingEnabled = true;
    return () => {
      gl.localClippingEnabled = prev;
    };
  }, [gl]);

  // Building floors bottom → top. FLOORS is [park, -1, 0, 1, 2, 3]; dropping the
  // park leaves [-1, 0, 1, 2, 3] so slab 0 = floor -1 (base), slab 4 = floor 3.
  const floors = useMemo(() => FLOORS.filter((f) => f.id !== "park"), []);

  const { slabs } = useMemo(() => {
    const H = height; // world height, base sits at y = 0
    const bandH = H / SLICES;

    // Measure the XZ footprint of the real geometry within each vertical band,
    // in the SAME world frame the slabs render in (offset + scale applied).
    const probe = new Group();
    const measured = root.clone(true);
    measured.position.set(offset[0], offset[1], offset[2]);
    probe.add(measured);
    probe.scale.setScalar(scale);
    probe.updateMatrixWorld(true);

    const bands = Array.from({ length: SLICES }, () => ({
      minx: Infinity,
      maxx: -Infinity,
      minz: Infinity,
      maxz: -Infinity,
    }));
    const v = new Vector3();
    measured.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        let b = Math.floor(v.y / bandH);
        if (b < 0) b = 0;
        if (b >= SLICES) b = SLICES - 1;
        const bb = bands[b];
        if (v.x < bb.minx) bb.minx = v.x;
        if (v.x > bb.maxx) bb.maxx = v.x;
        if (v.z < bb.minz) bb.minz = v.z;
        if (v.z > bb.maxz) bb.maxz = v.z;
      }
    });

    // One clipped shell + floor plate per band.
    const slabs = bands.map((bb, i) => {
      const yb = i * bandH;
      const yt = (i + 1) * bandH;
      const bottom = new Plane(new Vector3(0, 1, 0), -yb); // keep y >= yb
      const top = new Plane(new Vector3(0, -1, 0), yt); // keep y <= yt

      const shell = root.clone(true);
      shell.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = false;
        const clip = (mat: Material) => {
          const c = mat.clone();
          c.clippingPlanes = [bottom, top];
          c.clipShadows = true;
          c.side = DoubleSide;
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(clip) : clip(m.material);
        // The shells overlap in raycast space (clipping is visual only), so we
        // pick on the floor plates instead — disable picking on the shell.
        m.raycast = () => {};
      });

      const w = Math.max(0.6, bb.maxx - bb.minx);
      const d = Math.max(0.6, bb.maxz - bb.minz);
      const cx = Number.isFinite(bb.minx) ? (bb.minx + bb.maxx) / 2 : 0;
      const cz = Number.isFinite(bb.minz) ? (bb.minz + bb.maxz) / 2 : 0;
      return { yb, yt, bottom, top, shell, w, d, cx, cz };
    });

    return { H, slabs };
  }, [root, scale, offset, height]);

  // Fade the non-active slab shells when a floor is highlighted (no-op when not).
  useEffect(() => {
    slabs.forEach((s, i) => {
      const floor = floors[i];
      const dim = highlightFloorId != null && floor?.id !== highlightFloorId;
      s.shell.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mm) => {
          mm.transparent = dim;
          mm.opacity = dim ? 0.26 : 1;
          mm.depthWrite = !dim;
        });
      });
    });
  }, [slabs, floors, highlightFloorId]);

  // ---- explode animation (springy stagger, like FloorSpaces) ----
  const groupRefs = useRef<(Group | null)[]>([]);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (t.current < 5) t.current += dt;
    slabs.forEach((s, i) => {
      const p = Math.max(0, Math.min(1, (t.current - i * STAGGER) / DUR));
      const dy = i * gap * easeOutBack(p);
      const g = groupRefs.current[i];
      if (g) g.position.y = dy;
      // Clip planes ride up with the slab so each keeps its own cross-section.
      s.bottom.constant = -(s.yb + dy);
      s.top.constant = s.yt + dy;
    });
  });

  return (
    <group>
      {slabs.map((s, i) => {
        const floor = floors[i];
        const highlighting = highlightFloorId != null;
        const active = highlighting && floor?.id === highlightFloorId;
        const dim = highlighting && !active;
        return (
          <group
            key={i}
            ref={(el) => {
              groupRefs.current[i] = el;
            }}
          >
            {/* the genuine clipped pyramid band */}
            <group scale={scale}>
              <primitive object={s.shell} position={offset} />
            </group>

            {/* glowing outline halo under the active floor's plate */}
            {active && floor && (
              <mesh position={[s.cx, s.yb + 0.015, s.cz]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[s.w * 1.22, s.d * 1.22]} />
                <meshBasicMaterial color={floor.color} transparent opacity={0.24} depthWrite={false} />
              </mesh>
            )}

            {/* solid floor plate — caps the slab and is the click target */}
            <mesh
              position={[s.cx, s.yb + 0.04, s.cz]}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                if (floor) selectFloor(floor.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              <boxGeometry args={[s.w * 1.03, 0.12, s.d * 1.03]} />
              <meshStandardMaterial
                color={floor?.color ?? "#1a1f2b"}
                transparent={dim}
                opacity={dim ? 0.5 : 1}
                roughness={0.72}
                metalness={0.05}
                emissive={floor?.color ?? "#000000"}
                emissiveIntensity={active ? 0.55 : highlighting ? 0 : 0.07}
              />
            </mesh>

            {/* floor number tag on the left, like the terrace tags */}
            {showTags && floor && (
              <Html position={[s.cx - s.w / 2 - 0.9, s.yb + 0.2, s.cz]} center distanceFactor={16} occlude>
                <button
                  className="terrace-tag"
                  style={{ borderColor: floor.color }}
                  title={floor.name}
                  onClick={() => selectFloor(floor.id)}
                >
                  {floor.label}
                </button>
              </Html>
            )}
          </group>
        );
      })}

      {/* clean ground — no grass, no OSM surroundings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[24, 72]} />
        <meshStandardMaterial color="#13151d" roughness={1} />
      </mesh>
    </group>
  );
}

// The full-screen exploded view: shared renderer with default (unchanged) props.
export function ExplodedPyramid() {
  return <SlicedPyramidSlabs />;
}
