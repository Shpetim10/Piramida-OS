"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Box3, DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { OBJLoader, MTLLoader } from "three-stdlib";
import { FLOORS, usePyramid } from "@/lib/store";

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
  wall: "#e9ebf0", // white neighbouring buildings
  roof: "#d3d7df",
  vegetation: "#4a6b34", // grass park patches
  roads_primary: "#2a2e38",
  roads_service: "#23272f",
  paths_footway: "#c7ccd5",
  paths_cycleway: "#46531f",
  paths_steps: "#bcc2cc",
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
      if (Array.isArray(m.material)) m.material = m.material.map((mat) => surroundMaterial(slotName(mat)));
      else m.material = surroundMaterial(slotName(m.material));
      const isBuilding = m.name === "Buildings";
      m.castShadow = isBuilding;
      m.receiveShadow = !isBuilding;
    });

    return { root, scale: TARGET_SPAN / pyrW };
  }, [obj, materials]);
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

      {/* grass ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[80, 72]} />
        <meshStandardMaterial color="#3d5a2c" roughness={1} />
      </mesh>
    </group>
  );
}
