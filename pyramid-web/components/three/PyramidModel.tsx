"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Box3, DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3, type Material } from "three";
import { OBJLoader, MTLLoader } from "three-stdlib";
import { FLOORS, usePyramid } from "@/lib/store";

// ---------------------------------------------------------------------------
// EXACT exterior of the Pyramid of Tirana, loaded from the real captured mesh
// (public/model/piramid.obj + .mtl). We only post-process it — never reshape
// it — so the silhouette is the genuine article:
//   • drop the Google-Earth ground snapshot (mesh-5),
//   • auto-centre on X/Z and sit it on the ground (y = 0),
//   • auto-scale to fit the scene,
//   • lay a translucent GLASS SKIN over the exact surface,
//   • keep clickable floor tags for navigation.
// ---------------------------------------------------------------------------

const TARGET_SPAN = 18; // fit the larger horizontal dimension to this many world units
const TERRAIN_MESH = "mesh-5"; // the Google-Earth snapshot plane — excluded

function useProcessedModel() {
  const materials = useLoader(MTLLoader, "/model/piramid.mtl");
  const obj = useLoader(OBJLoader, "/model/piramid.obj", (loader) => {
    materials.preload();
    (loader as OBJLoader).setMaterials(materials);
  });

  return useMemo(() => {
    // Clone so we never mutate react-three's cached loader result.
    const root = obj.clone(true);

    // Remove the Google-Earth terrain capture.
    const terrain = root.getObjectByName(TERRAIN_MESH);
    if (terrain) terrain.removeFromParent();

    // Shadows + double-sided (captured meshes often have inconsistent winding).
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => mat && ((mat as Material).side = DoubleSide));
    });

    // Measure the real geometry to centre + scale it.
    const box = new Box3().setFromObject(root);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = TARGET_SPAN / Math.max(size.x, size.z);

    // Position (in model units, applied before the outer scale): centre on
    // X/Z, drop the base to y = 0.
    const offset: [number, number, number] = [-center.x, -box.min.y, -center.z];

    // GLASS SKIN: a second copy of the exact geometry, hugging the surface.
    // Only over the building structure — not the flat tan plaza (mesh-4).
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

export function PyramidModel({ interactive = true }: { interactive?: boolean }) {
  const group = useRef<Group>(null);
  const view = usePyramid((s) => s.view);
  const selectFloor = usePyramid((s) => s.selectFloor);
  const { root, glass, scale, offset, height, halfX } = useProcessedModel();

  useFrame((_, dt) => {
    if (group.current && view === "exterior") group.current.rotation.y += dt * 0.07;
  });

  // Stack the floor tags up one side of the real building for navigation.
  const tagged = FLOORS.filter((f) => f.id !== "park");
  const yFor = (i: number) => 0.4 + (i / Math.max(1, tagged.length - 1)) * (height - 0.8);

  return (
    <group ref={group}>
      <group scale={scale}>
        <primitive object={root} position={offset} />
        <primitive object={glass} position={offset} scale={1.004} />
      </group>

      {interactive &&
        view === "exterior" &&
        tagged.map((f, i) => (
          <Html key={String(f.id)} position={[halfX + 0.7, yFor(i), 0]} center distanceFactor={20} occlude>
            <button className="terrace-tag" onClick={() => selectFloor(f.id)} style={{ borderColor: f.color }}>
              {f.label}
            </button>
          </Html>
        ))}

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#d7dde4" />
      </mesh>
    </group>
  );
}
