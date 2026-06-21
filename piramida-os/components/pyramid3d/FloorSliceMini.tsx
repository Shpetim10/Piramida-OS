"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { usePyramid } from "@/lib/store";
import { SlicedPyramidSlabs } from "./ExplodedPyramid";

// Compact 3D mini view of the REAL sliced pyramid, shown in the explore floor-view
// side legend. It renders the same clipped cross-section slabs as the full
// exploded ("layers") view (via the shared SlicedPyramidSlabs) and highlights the
// floor you're currently looking at. Its own small WebGL context, transparent so
// the panel behind shows through.
export default function FloorSliceMini() {
  const floorId = usePyramid((s) => s.floorId);

  return (
    <Canvas
      camera={{ position: [13, 8, 17], fov: 42 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <hemisphereLight args={["#dce8ff", "#10131a", 1.0]} />
      <directionalLight position={[8, 14, 6]} intensity={1.15} />
      <ambientLight intensity={0.4} />

      <Suspense fallback={null}>
        <SlicedPyramidSlabs highlightFloorId={floorId} showTags={false} gap={0.95} />
      </Suspense>

      <OrbitControls
        makeDefault
        target={[0, 4, 0]}
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.65}
        minPolarAngle={0.55}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
