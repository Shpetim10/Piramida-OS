"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Html, Instances, Instance } from "@react-three/drei";
import { Box3, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { OBJLoader, MTLLoader } from "three-stdlib";
import { FLOORS, usePyramid } from "@/lib/store";

// ---- realistic neighbourhood building tones --------------------------------
// Warm whites, beige, terracotta, soft blue-greys — lively but believable so the
// surroundings support the pyramid hero without competing.
const CITY_PALETTE = [
  "#e8e1d2", "#d9c3a3", "#c98a63", "#b7c2cb", "#cdb389",
  "#aab9a4", "#dde0e4", "#c2a684", "#9fb2c0", "#e4d8c4",
].map((c) => new Color(c));

const hash2 = (a: number, b: number) => (((a * 73856093) ^ (b * 19349663)) >>> 0);

/** Paint per-building colour onto a merged Buildings mesh via vertex colours:
 *  quantise each vertex to a coarse cell so each block reads as one tasteful
 *  tone while neighbours differ. Computed once at load (cheap). */
function applyCityColors(geo: BufferGeometry, cell: number) {
  const pos = geo.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  const tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    const cx = Math.floor(pos.getX(i) / cell);
    const cz = Math.floor(pos.getZ(i) / cell);
    const h = hash2(cx, cz);
    const base = CITY_PALETTE[h % CITY_PALETTE.length];
    tmp.copy(base).multiplyScalar(0.9 + ((h % 17) / 17) * 0.2); // subtle per-block brightness
    arr[i * 3] = tmp.r;
    arr[i * 3 + 1] = tmp.g;
    arr[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new BufferAttribute(arr, 3));
}

// ---- sparse, refined park trees -------------------------------------------
// Calm, slightly muted sage greens; warm tones are rare and soft so the scene
// reads premium rather than busy.
const TREE_GREENS = ["#5b8a52", "#6e9b62", "#4d7a47", "#7aa36b", "#5f8f55"].map((c) => new Color(c));
const TREE_WARM = ["#c08a4a", "#b07050"].map((c) => new Color(c)); // rare, muted seasonal accent

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// EXACT exterior of the Pyramid of Tirana, loaded from the real captured mesh
// (public/model/piramid.obj + .mtl). We only post-process it — never reshape it:
//   • drop the Google-Earth ground snapshot (mesh-5),
//   • recolour the red strips to the Pyramid OS lime,
//   • auto-centre on X/Z and sit it on the ground (y = 0),
//   • lay a translucent GLASS SKIN over the exact surface,
//   • keep clickable floor tags for navigation.
//
// Around it we drop the REAL surroundings from an OpenStreetMap extract
// (public/model/site.obj): the neighbouring buildings (white) on a grass ground,
// scaled so the OSM pyramid footprint matches our captured pyramid.
// ---------------------------------------------------------------------------

const TARGET_SPAN = 18; // fit the larger horizontal dimension to this many world units
const TERRAIN_MESH = "mesh-5"; // the Google-Earth snapshot plane — excluded

// ---- the captured pyramid -------------------------------------------------
// Exported so the exploded "sliced pyramid" view (ExplodedPyramid.tsx) can reuse
// the exact same processed mesh — lime strips, centring, scale — without reloading.
export function useProcessedModel() {
  const materials = useLoader(MTLLoader, "/model/piramid.mtl");
  const obj = useLoader(OBJLoader, "/model/piramid.obj", (loader) => {
    materials.preload();
    (loader as OBJLoader).setMaterials(materials);
  });

  return useMemo(() => {
    const root = obj.clone(true);

    // Remove the Google-Earth terrain capture.
    root.getObjectByName(TERRAIN_MESH)?.removeFromParent();

    // Shadows + double-sided, and recolour the red strips to lime.
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if (!mat) return;
        const sm = mat as MeshStandardMaterial;
        sm.side = DoubleSide;
        const c = sm.color;
        const isRed = sm.name === "_Color_A01_" || (c && c.r > 0.35 && c.g < 0.2 && c.b < 0.2);
        if (isRed && c) {
          c.set("#d6ff00");
          if (sm.emissive) {
            sm.emissive.set("#46550a");
            sm.emissiveIntensity = 0.3;
          }
        }
      });
    });

    const box = new Box3().setFromObject(root);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = TARGET_SPAN / Math.max(size.x, size.z);
    const offset: [number, number, number] = [-center.x, -box.min.y, -center.z];

    // GLASS SKIN: a second copy of the exact geometry, hugging the surface.
    const glass = root.clone(true);
    glass.getObjectByName("mesh-4")?.removeFromParent();
    const glassMat = new MeshStandardMaterial({
      color: "#cfe8ff",
      transparent: true,
      opacity: 0.16,
      roughness: 0.05,
      metalness: 0.25,
      side: DoubleSide,
      depthWrite: false,
    });
    glass.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.material = glassMat;
      m.castShadow = false;
      m.receiveShadow = false;
    });

    return { root, glass, scale, offset, height: size.y * scale, halfX: (size.x / 2) * scale };
  }, [obj, materials]);
}

// ---- the OSM surroundings (white buildings, no pyramid) -------------------
const SURROUND_COLORS: Record<string, string> = {
  wall: "#e9ebf0", // fallback — real buildings get per-block vertex colours
  roof: "#d3d7df",
  vegetation: "#363b39", // dark muted park patches that blend into the slate ground
  roads_primary: "#3a414e",
  roads_service: "#414956",
  paths_footway: "#d4d9e0",
  paths_cycleway: "#5d7a2c",
  paths_steps: "#c8ced7",
};

function surroundMaterial(slot: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: SURROUND_COLORS[slot] ?? "#cfd3da",
    roughness: slot === "wall" || slot === "roof" ? 0.8 : 0.95,
    metalness: 0.0,
    side: DoubleSide,
  });
}

function useSurroundings() {
  const materials = useLoader(MTLLoader, "/model/site.mtl");
  const obj = useLoader(OBJLoader, "/model/site.obj", (loader) => {
    materials.preload();
    (loader as OBJLoader).setMaterials(materials);
  });

  return useMemo(() => {
    const root = obj.clone(true);

    // Measure the OSM pyramid footprint (to match our captured pyramid), then
    // drop the OSM pyramid + the flat terrain planes — we supply our own.
    const pyr = root.getObjectByName("Pyramid");
    const pyrW = pyr ? new Box3().setFromObject(pyr).getSize(new Vector3()).x : 78.29;
    pyr?.removeFromParent();
    root.getObjectByName("Terrain")?.removeFromParent();
    root.getObjectByName("Terrain.001")?.removeFromParent();

    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const slotName = (mat: unknown) => (mat as MeshStandardMaterial)?.name ?? "";
      const isBuilding = m.name === "Buildings";

      if (isBuilding) {
        // varied, realistic facade tones via per-block vertex colours; roofs a
        // touch darker. Cell sized from the block span so each building is ~1 tone.
        const span = new Box3().setFromObject(m).getSize(new Vector3());
        applyCityColors(m.geometry as BufferGeometry, Math.max(span.x, span.z) / 11);
        const cityMat = (slot: string) =>
          new MeshStandardMaterial({
            color: slot === "roof" ? "#b9bcc2" : "#ffffff",
            vertexColors: true,
            roughness: 0.82,
            metalness: 0,
            side: DoubleSide,
          });
        m.material = Array.isArray(m.material) ? m.material.map((mat) => cityMat(slotName(mat))) : cityMat(slotName(m.material));
      } else {
        if (Array.isArray(m.material)) m.material = m.material.map((mat) => surroundMaterial(slotName(mat)));
        else m.material = surroundMaterial(slotName(m.material));
      }

      m.castShadow = isBuilding;
      m.receiveShadow = !isBuilding;
    });

    // Occupancy grid of building footprints (in WORLD units = local * scale) so
    // trees can be placed clear of every building block.
    const scale = TARGET_SPAN / pyrW;
    const occCell = 1.4;
    const occ = new Set<string>();
    const buildings = root.getObjectByName("Buildings") as Mesh | undefined;
    if (buildings) {
      const pos = (buildings.geometry as BufferGeometry).getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const cx = Math.round((pos.getX(i) * scale) / occCell);
        const cz = Math.round((pos.getZ(i) * scale) / occCell);
        occ.add(`${cx},${cz}`);
      }
    }

    return { root, scale, occ, occCell };
  }, [obj, materials]);
}

/** Bold low-poly park trees ringing the pyramid and clustered out across the
 *  green, mirroring the real tree-lined site. Instanced (trunk + canopy = 2
 *  draw calls) and deterministic so they stay put. Kept off the central plaza. */
function SiteTrees({ halfX, occ, occCell }: { halfX: number; occ: Set<string>; occCell: number }) {
  const trees = useMemo(() => {
    const rng = mulberry32(0x7a11ee);
    const pick = () => {
      const pal = rng() < 0.1 ? TREE_WARM : TREE_GREENS; // mostly calm green, rare warm accent
      return pal[Math.floor(rng() * pal.length)];
    };

    // reject any position within CLEAR world-units of a building footprint
    const CLEAR = 2.2;
    const rc = Math.max(1, Math.ceil(CLEAR / occCell));
    const blocked = (x: number, z: number) => {
      const cx = Math.round(x / occCell);
      const cz = Math.round(z / occCell);
      for (let dx = -rc; dx <= rc; dx++) for (let dz = -rc; dz <= rc; dz++) if (occ.has(`${cx + dx},${cz + dz}`)) return true;
      return false;
    };

    const out: { x: number; z: number; s: number; ry: number; c: Color; tall: number }[] = [];

    // a few sparse accent trees, kept well clear of the pyramid so it breathes
    const r0 = halfX + 4.2;
    const r1 = halfX + 8.5;
    const ringN = 9;
    for (let i = 0; i < ringN; i++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const a = (i / ringN) * Math.PI * 2 + (rng() - 0.5) * 0.7;
        const r = r0 + rng() * (r1 - r0);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (blocked(x, z)) continue;
        out.push({ x, z, s: 0.7 + rng() * 0.5, ry: rng() * 6.28, c: pick(), tall: rng() });
        break;
      }
    }

    // a handful of small clusters dropped into open green gaps between the streets
    const clusters = 5;
    for (let c = 0; c < clusters; c++) {
      let cx = 0;
      let cz = 0;
      let placed = false;
      for (let attempt = 0; attempt < 14; attempt++) {
        const ca = rng() * Math.PI * 2;
        const cr = halfX + 13 + rng() * 16;
        cx = Math.cos(ca) * cr;
        cz = Math.sin(ca) * cr;
        if (!blocked(cx, cz)) {
          placed = true;
          break;
        }
      }
      if (!placed) continue;
      const n = 3 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const a = rng() * Math.PI * 2;
          const rr = rng() * 2.2;
          const x = cx + Math.cos(a) * rr;
          const z = cz + Math.sin(a) * rr;
          if (blocked(x, z)) continue;
          out.push({ x, z, s: 0.72 + rng() * 0.55, ry: rng() * 6.28, c: pick(), tall: rng() });
          break;
        }
      }
    }
    return out;
  }, [halfX, occ, occCell]);

  return (
    <group>
      <Instances limit={trees.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.09, 0.12, 0.8, 6]} />
        <meshStandardMaterial color="#7a5a39" roughness={1} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 0.4 * t.s, t.z]} scale={t.s} rotation={[0, t.ry, 0]} />
        ))}
      </Instances>
      <Instances limit={trees.length} castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
        {trees.map((t, i) => {
          const cs = t.s * (0.85 + t.tall * 0.4);
          return (
            <Instance
              key={i}
              position={[t.x, 0.55 * t.s + 0.85 * cs, t.z]}
              scale={cs}
              rotation={[t.tall * 2.2, t.ry, t.tall * 1.3]}
              color={t.c}
            />
          );
        })}
      </Instances>
    </group>
  );
}

export function PyramidModel({ interactive = true }: { interactive?: boolean }) {
  const group = useRef<Group>(null);
  const view = usePyramid((s) => s.view);
  const selectFloor = usePyramid((s) => s.selectFloor);
  const { root, glass, scale, offset, height, halfX } = useProcessedModel();
  const surroundings = useSurroundings();

  useFrame((_, dt) => {
    if (group.current && view === "exterior") group.current.rotation.y += dt * 0.06;
  });

  // Stack the floor tags up one side of the real building for navigation.
  const tagged = FLOORS.filter((f) => f.id !== "park");
  const yFor = (i: number) => 0.4 + (i / Math.max(1, tagged.length - 1)) * (height - 0.8);

  return (
    <group ref={group}>
      {/* surrounding OSM neighbourhood (buildings + paths), centred on the pyramid */}
      <group scale={surroundings.scale} position={[0, 0.01, 0]}>
        <primitive object={surroundings.root} />
      </group>

      {/* the captured pyramid */}
      <group scale={scale}>
        <primitive object={root} position={offset} />
        <primitive object={glass} position={offset} scale={1.004} />
      </group>

      {/* Pyramid OS lime "launch pad" ring around the pyramid base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[halfX + 0.5, halfX + 0.85, 96]} />
        <meshStandardMaterial color="#d6ff00" emissive="#d6ff00" emissiveIntensity={0.5} transparent opacity={0.7} toneMapped={false} />
      </mesh>

      {interactive &&
        view === "exterior" &&
        tagged.map((f, i) => (
          <Html key={String(f.id)} position={[halfX + 0.7, yFor(i), 0]} center distanceFactor={20} occlude>
            <button className="terrace-tag" onClick={() => selectFloor(f.id)} style={{ borderColor: f.color }}>
              {f.label}
            </button>
          </Html>
        ))}

      {/* sparse park trees, placed clear of the pyramid and every building block */}
      <SiteTrees halfX={halfX} occ={surroundings.occ} occCell={surroundings.occCell} />

      {/* soft dark ground — a calm neutral slate that sits under the dark backdrop;
          large so it fades into the fog with no hard edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[200, 80]} />
        <meshStandardMaterial color="#2a2e36" roughness={1} />
      </mesh>
    </group>
  );
}
