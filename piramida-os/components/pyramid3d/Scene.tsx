"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { Group, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { usePyramid, useResolvedEvent } from "@/lib/store";
import { getSpace } from "@/lib/pyramid-data";
import type { LiveEventMarker } from "@/lib/services/events";
import { PyramidModel } from "./PyramidModel";
import { ExplodedPyramid } from "./ExplodedPyramid";
import { FloorSpaces } from "./FloorSpaces";
import { InteriorRoom } from "./InteriorRoom";

// Camera presets per view: [cameraPos, target]
const PRESETS = {
  exterior: { pos: new Vector3(22, 14, 22), tar: new Vector3(0, 2, 0) },
  floor: { pos: new Vector3(0.1, 13, 13), tar: new Vector3(0, 0.5, 0) },
  interior: { pos: new Vector3(0.1, 6.5, 9.5), tar: new Vector3(0, 1, 0) },
  exploded: { pos: new Vector3(15, 9, 20), tar: new Vector3(0, 4, 0) },
} as const;

// Hero (bare) framing: close + low look-at so the lone pyramid is large and sits
// high in the frame (the empty space below is where the copy reveals on scroll).
const HERO_EXTERIOR = { pos: new Vector3(11, 7.2, 11), tar: new Vector3(0, -0.6, 0) } as const;

// easing helpers ------------------------------------------------------------
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10); // very soft start/stop
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); // slight spring overshoot
};

function CameraRig({ controlsRef, hero = false }: { controlsRef: React.RefObject<OrbitControlsImpl | null>; hero?: boolean }) {
  const view = usePyramid((s) => s.view);
  const floorId = usePyramid((s) => s.floorId);
  const spaceId = usePyramid((s) => s.spaceId);
  const camera = useThree((s) => s.camera);
  const anim = useRef({ active: false, t: 0, arc: 0, fromP: new Vector3(), toP: new Vector3(), fromT: new Vector3(), toT: new Vector3() });
  const prev = useRef<string>("");

  // Re-frame on every navigation (view, floor, or room), not just view changes.
  useEffect(() => {
    const key = `${view}:${floorId}:${spaceId}`;
    if (prev.current === key) return;
    prev.current = key;
    const ctr = controlsRef.current;
    const preset = view === "exterior" && hero ? HERO_EXTERIOR : PRESETS[view];
    const fromP = camera.position.clone();
    const toP = preset.pos.clone();
    anim.current = {
      active: true,
      t: 0,
      // Lift the camera along the path for a gentle fly-over rather than a flat lerp.
      arc: Math.min(4, fromP.distanceTo(toP) * 0.14),
      fromP,
      toP,
      fromT: (ctr?.target.clone() as Vector3) ?? new Vector3(),
      toT: preset.tar.clone(),
    };
    if (ctr) ctr.enabled = false;
  }, [view, floorId, spaceId, camera, controlsRef]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a.active) return;
    a.t = Math.min(1, a.t + dt / 0.85); // ~0.85s cinematic glide
    const e = smootherstep(a.t);
    camera.position.lerpVectors(a.fromP, a.toP, e);
    camera.position.y += Math.sin(Math.PI * a.t) * a.arc; // 0 at both ends → exact landing
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

// Whole-group entrance: a springy scale-up + rise. Transform-only, so it never
// disturbs intentionally-transparent materials (glass skin, LED strips).
function ViewIntro({ children, rise = 0.5 }: { children: React.ReactNode; rise?: number }) {
  const group = useRef<Group>(null);
  const t = useRef(0);
  const DUR = 0.6;

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || t.current >= DUR) return;
    t.current = Math.min(DUR, t.current + dt);
    const p = t.current / DUR;
    g.scale.setScalar(0.9 + 0.1 * easeOutBack(p));
    g.position.y = (1 - smootherstep(p)) * -rise;
  });

  return (
    <group ref={group} scale={0.9} position={[0, -rise, 0]}>
      {children}
    </group>
  );
}

function Content({ interactive, highlight, liveEvents, bare }: { interactive: boolean; highlight?: Set<string>; liveEvents?: Map<string, LiveEventMarker>; bare?: boolean }) {
  const view = usePyramid((s) => s.view);
  const floorId = usePyramid((s) => s.floorId);
  const spaceId = usePyramid((s) => s.spaceId);

  const space = floorId != null && spaceId ? getSpace(floorId, spaceId) : undefined;
  const event = useResolvedEvent(spaceId, space?.event);

  // The interior room shell is sized from the block's STATIC plan footprint
  // ([w, d] of space.size), never from the furniture placed inside it.
  const footprint: [number, number] = space ? [space.size[0], space.size[2]] : [2, 2];

  // The floor view animates per-block (staggered assembly) inside FloorSpaces, so
  // it skips the whole-group ViewIntro; other views use the springy group entrance.
  if (view === "exterior")
    return (
      <ViewIntro key="exterior" rise={0.8}>
        <PyramidModel interactive={interactive} surroundings={!bare} heroBlocks={bare} />
      </ViewIntro>
    );

  if (view === "exploded")
    // The slabs self-animate (explode stagger), so no whole-group ViewIntro.
    return (
      <group key="exploded">
        <ExplodedPyramid />
      </group>
    );

  if (view === "floor" && floorId != null)
    return (
      <group key={`floor:${floorId}`}>
        <FloorSpaces floorId={floorId} interactive={interactive} highlight={highlight} liveEvents={liveEvents} />
      </group>
    );

  if (view === "interior" && event)
    return (
      <ViewIntro key={`interior:${spaceId}`}>
        <InteriorRoom event={event} accent={space?.color ?? "#d6ff00"} footprint={footprint} stairs={!!space?.stairs} />
      </ViewIntro>
    );

  if (view === "interior" && space && !event)
    return (
      <ViewIntro key={`interior:${spaceId}`}>
        <InteriorRoom event={{ title: space.name, layout: "standing", chairs: 0, status: "draft" }} accent={space.color} footprint={footprint} stairs={!!space.stairs} />
      </ViewIntro>
    );

  return null;
}

export interface SceneProps {
  /** full orbit + clickable rooms (explore). When false the scene is a locked,
   *  decorative presentation (home hero / guest map). */
  interactive?: boolean;
  /** slowly orbit the camera (used for the locked guest-map presentation). */
  autoRotate?: boolean;
  /** AI-recommended room ids to glow in Pyramid OS lime on the floor view. */
  highlight?: string[];
  /** Live events (from the DB timeline) to mark with LIVE pins on the floor view. */
  liveEvents?: LiveEventMarker[];
  /** Hero mode: lone pyramid (no city/trees), pure-black backdrop, lime-tinted
   *  lighting and a closer, larger framing. */
  bare?: boolean;
}

export default function Scene({ interactive = true, autoRotate = false, highlight, liveEvents, bare = false }: SceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const back = usePyramid((s) => s.back);
  const view = usePyramid((s) => s.view);
  const highlightSet = useMemo(() => (highlight ? new Set(highlight) : undefined), [highlight]);
  // Key live events by pyramid room id so FloorSpaces can look each block up.
  const liveMap = useMemo(
    () => (liveEvents && liveEvents.length ? new Map(liveEvents.map((e) => [e.roomId, e])) : undefined),
    [liveEvents],
  );

  // Only the floor park is daytime. The exterior is a soft dark backdrop; the
  // bare hero is pure black so the lit pyramid emerges from darkness.
  const floorView = view === "floor";
  const exteriorView = view === "exterior";
  const daylight = floorView;
  const heroExterior = exteriorView && bare;

  const bg = floorView ? "#edf1ec" : heroExterior ? "#0d0d12" : exteriorView ? "#1e222a" : "#0d0d12";

  return (
    <Canvas
      shadows
      camera={{ position: [22, 14, 22], fov: 45 }}
      dpr={[1, 2]}
      onPointerMissed={() => interactive && view !== "exterior" && back()}
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, heroExterior ? 22 : floorView ? 46 : 30, heroExterior ? 60 : floorView ? 120 : exteriorView ? 95 : 85]} />

      {/* Warm neutral key light + soft sky so the real concrete reads white/grey;
          the lime comes from the building's strips + the accent rim below. */}
      <hemisphereLight
        args={[
          daylight ? "#ffffff" : heroExterior ? "#eef3e6" : "#dce8ff",
          daylight ? "#cdd8c8" : heroExterior ? "#0a0b08" : "#1a1f2b",
          daylight ? 1.45 : heroExterior ? 1.0 : 1.05,
        ]}
      />
      <directionalLight
        position={[12, 18, 8]}
        intensity={daylight ? 2.0 : heroExterior ? 2.1 : 1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <ambientLight intensity={daylight ? 0.8 : heroExterior ? 0.5 : 0.42} />

      {/* lime accent rim from the opposite side — paints the logo's green-yellow
          onto the pyramid's shaded face. Hero only. */}
      {heroExterior && <directionalLight position={[-13, 6, -9]} intensity={0.42} color="#c8f000" />}

      <Suspense fallback={null}>
        <Content interactive={interactive} highlight={highlightSet} liveEvents={liveMap} bare={bare} />
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={floorView ? 0.5 : heroExterior ? 0.55 : exteriorView ? 0.42 : 0.4}
        scale={heroExterior ? 30 : 40}
        blur={2}
        far={12}
        color={floorView ? "#5a6b52" : "#000000"}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableRotate={interactive}
        enableZoom={interactive}
        autoRotate={autoRotate}
        autoRotateSpeed={0.45}
        minDistance={6}
        maxDistance={70}
        maxPolarAngle={Math.PI / 2.05}
      />
      <CameraRig controlsRef={controlsRef} hero={bare} />
    </Canvas>
  );
}
