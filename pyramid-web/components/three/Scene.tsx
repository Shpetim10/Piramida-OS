"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { usePyramid, useResolvedEvent } from "@/lib/store";
import { getFloor, getSpace } from "@/lib/pyramid-data";
import { PyramidModel } from "./PyramidModel";
import { FloorSpaces } from "./FloorSpaces";
import { InteriorRoom } from "./InteriorRoom";

// Camera presets per view: [cameraPos, target]
const PRESETS = {
  exterior: { pos: new Vector3(20, 11, 20), tar: new Vector3(0, 2.2, 0) },
  floor: { pos: new Vector3(0.1, 13, 13), tar: new Vector3(0, 0.5, 0) },
  interior: { pos: new Vector3(0.1, 6.5, 9.5), tar: new Vector3(0, 1, 0) },
} as const;

function CameraRig({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const view = usePyramid((s) => s.view);
  const camera = useThree((s) => s.camera);
  const anim = useRef({ active: false, t: 0, fromP: new Vector3(), toP: new Vector3(), fromT: new Vector3(), toT: new Vector3() });
  const prev = useRef<string>("");

  useEffect(() => {
    if (prev.current === view) return;
    prev.current = view;
    const ctr = controlsRef.current;
    const preset = PRESETS[view];
    anim.current = {
      active: true,
      t: 0,
      fromP: camera.position.clone(),
      toP: preset.pos.clone(),
      fromT: (ctr?.target.clone() as Vector3) ?? new Vector3(),
      toT: preset.tar.clone(),
    };
    if (ctr) ctr.enabled = false;
  }, [view, camera, controlsRef]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a.active) return;
    a.t = Math.min(1, a.t + dt * 1.6);
    const e = 1 - Math.pow(1 - a.t, 3); // easeOutCubic
    camera.position.lerpVectors(a.fromP, a.toP, e);
    const ctr = controlsRef.current;
    if (ctr) {
      ctr.target.lerpVectors(a.fromT, a.toT, e);
      ctr.update();
    }
    if (a.t >= 1) {
      a.active = false;
      if (ctr) ctr.enabled = true;
    }
  });

  return null;
}

function Content() {
  const view = usePyramid((s) => s.view);
  const floorId = usePyramid((s) => s.floorId);
  const spaceId = usePyramid((s) => s.spaceId);

  const space = floorId != null && spaceId ? getSpace(floorId, spaceId) : undefined;
  const event = useResolvedEvent(spaceId, space?.event);

  // The interior room shell is sized from the block's STATIC plan footprint
  // ([w, d] of space.size), never from the furniture placed inside it.
  const footprint: [number, number] = space ? [space.size[0], space.size[2]] : [2, 2];

  if (view === "exterior") return <PyramidModel />;
  if (view === "floor" && floorId != null) return <FloorSpaces floorId={floorId} />;
  if (view === "interior" && event) return <InteriorRoom event={event} accent={space?.color ?? "#3aa6e0"} footprint={footprint} stairs={!!space?.stairs} />;
  if (view === "interior" && space && !event)
    // no-event space: show empty room shell
    return <InteriorRoom event={{ title: space.name, layout: "standing", chairs: 0, status: "draft" }} accent={space.color} footprint={footprint} stairs={!!space.stairs} />;
  return null;
}

export default function Scene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const back = usePyramid((s) => s.back);
  const view = usePyramid((s) => s.view);

  return (
    <Canvas
      shadows
      camera={{ position: [17, 13, 17], fov: 45 }}
      dpr={[1, 2]}
      onPointerMissed={() => view !== "exterior" && back()}
    >
      <color attach="background" args={["#f3f5f8"]} />
      <fog attach="fog" args={["#f3f5f8", 28, 60]} />

      <hemisphereLight args={["#ffffff", "#b9c2cf", 1.1]} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <ambientLight intensity={0.3} />

      <Suspense fallback={null}>
        <Content />
      </Suspense>

      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={40} blur={2} far={12} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        minDistance={6}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.05}
      />
      <CameraRig controlsRef={controlsRef} />
    </Canvas>
  );
}
