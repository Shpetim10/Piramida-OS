"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Html, Instances, Instance } from "@react-three/drei";
import { Color, Group } from "three";
import { getFloor, type EventSpace } from "@/lib/pyramid-data";
import { usePyramid } from "@/lib/store";
import type { LiveEventMarker } from "@/lib/services/events";

const ACCENT = "#d6ff00"; // Pyramid OS lime
const TRIM = "#eef1f5"; // light window/door trim (cabin style)
const GLASS = "#86a8bd"; // muted slate-blue glass

/** Tenant cubes recede: desaturate + lift the brand colour toward a cool light grey. */
const mutedColor = (hex: string) => new Color(hex).lerp(new Color("#c7cdd6"), 0.5).getStyle();
/** Darken a brand colour toward slate (door panels, recesses). */
const darken = (hex: string, amt: number) => new Color(hex).lerp(new Color("#1c2128"), amt).getStyle();

/** Tiny seeded PRNG so the park tree-ring is deterministic across renders. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One stable scatter of low-poly trees ringing the building plate (computed once).
const TREES = (() => {
  const rng = mulberry32(0x50594d44);
  const out: { x: number; z: number; s: number; ry: number; tint: number }[] = [];
  const COUNT = 48;
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.16;
    const r = 9.0 + rng() * 3.4;
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.78 + rng() * 0.7, ry: rng() * Math.PI * 2, tint: rng() });
  }
  return out;
})();
const LEAF_LIGHT = new Color("#86b35c");
const LEAF_DARK = new Color("#5d8f43");

/** 1–2 letter fallback drawn from the tenant name when no logo is supplied. */
function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

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

/**
 * Classic teardrop location pin hovering above a block, carrying the tenant's
 * logo (or initials fallback). Shared by SpaceCube + StairsSpace.
 *  - tenant pins are quiet, light heads that recede;
 *  - bookable pins get a vivid accent head + pulse so the eye lands on them.
 * `occlude` + `distanceFactor` keep it zoom-scaled and hidden behind geometry.
 */
function SpacePin({
  space,
  bookable,
  y,
  onSelect,
}: {
  space: EventSpace;
  bookable: boolean;
  y: number;
  onSelect: () => void;
}) {
  const initials = useMemo(() => initialsOf(space.name), [space.name]);

  // Bookable: vivid filled head in the space colour. Tenant: light head, colour
  // only in the glyph so it stays muted against the dark scene.
  const headStyle = bookable
    ? { background: space.color, color: "#fff" }
    : { color: new Color(space.color).lerp(new Color("#11151d"), 0.32).getStyle() };

  const inner = space.logo ? (
    <img className="map-pin-logo" src={space.logo} alt={space.name} />
  ) : (
    <span className="map-pin-initials">{initials}</span>
  );

  const pin = (
    <div
      className={`map-pin ${bookable ? "bookable" : "tenant"}`}
      title={space.name}
      onClick={(e) => {
        // url links handle their own navigation; otherwise drive selection.
        if (!space.url) {
          e.stopPropagation();
          if (bookable) onSelect();
        }
      }}
    >
      {bookable && <span className="map-pin-pulse" aria-hidden />}
      <span className="map-pin-head" style={headStyle}>
        <span className="map-pin-inner">{inner}</span>
      </span>
    </div>
  );

  return (
    <Html position={[0, y, 0]} center distanceFactor={14} occlude>
      {space.url ? (
        <a className="map-pin-link" href={space.url} target="_blank" rel="noreferrer noopener">
          {pin}
        </a>
      ) : (
        pin
      )}
    </Html>
  );
}

/**
 * A distinct pulsing "LIVE" marker hovering above a block that currently has a
 * live event (from the DB event timeline, not the static pyramid data). Hovering
 * it reveals a details card *below* the block: title, time window, status and
 * expected guests. Self-contained inline styling (no tooltip lib) so it sits
 * cleanly on top of the existing teardrop SpacePin.
 */
function LiveMarker({ ev, y }: { ev: LiveEventMarker; y: number }) {
  const [open, setOpen] = useState(false);
  const fmt = (d: Date) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    // zIndexRange held at a constant above drei's default ceiling (16777271) so
    // the LIVE pin + popup always sit on top of every other Html overlay (the
    // tenant label pins) instead of being occluded by them.
    <Html position={[0, y, 0]} center distanceFactor={13} zIndexRange={[100000000, 100000000]}>
      <div
        style={{ position: "relative", display: "inline-flex", pointerEvents: "auto" }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerOut={() => setOpen(false)}
      >
        {/* sleek dark-glass LIVE chip with a soft red halo dot (matches the HUD) */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 9px 3px 7px",
            borderRadius: 999,
            background: "rgba(15,15,21,.78)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            color: "#ff6b7a",
            font: "700 9px/1 'JetBrains Mono', monospace",
            letterSpacing: ".18em",
            whiteSpace: "nowrap",
            border: "1px solid rgba(255,107,122,.5)",
            boxShadow: "0 3px 12px rgba(0,0,0,.4)",
            cursor: "default",
          }}
        >
          <span style={{ position: "relative", width: 6, height: 6, display: "inline-block" }}>
            <span className="live-pin-pulse" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#ff4d62" }} />
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#ff4d62", boxShadow: "0 0 5px rgba(255,77,98,.9)" }} />
          </span>
          LIVE
        </div>

        {/* details popup — opens UPWARD so it never overlaps the block's tenant
            label/pin sitting just below this marker */}
        {open && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 9px)",
              left: "50%",
              transform: "translateX(-50%)",
              width: 210,
              padding: "12px 13px",
              borderRadius: 12,
              background: "rgba(13,13,18,.97)",
              border: "1px solid rgba(255,107,122,.4)",
              boxShadow: "0 14px 34px rgba(0,0,0,.55)",
              color: "#fff",
              textAlign: "left",
              pointerEvents: "none",
            }}
          >
            <div style={{ font: "700 13px/1.3 Inter, sans-serif", marginBottom: 9, letterSpacing: "-.01em" }}>{ev.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, font: "500 11px 'JetBrains Mono', monospace", color: "#AEB5C2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>TIME</span>
                <span style={{ color: "#fff" }}>{fmt(ev.eventStart)}–{fmt(ev.eventEnd)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>GUESTS</span>
                <span style={{ color: "#fff" }}>{ev.expectedGuests ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>STATUS</span>
                <span style={{ color: "#ff6b7a", fontWeight: 700 }}>{ev.status}</span>
              </div>
            </div>
            {/* little pointer tail toward the marker */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: "100%",
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: 9,
                height: 9,
                marginTop: -5,
                background: "rgba(13,13,18,.97)",
                borderRight: "1px solid rgba(255,107,122,.4)",
                borderBottom: "1px solid rgba(255,107,122,.4)",
              }}
            />
          </div>
        )}
      </div>
    </Html>
  );
}

/** App-style radial layer of colour-coded tenant cubes for the selected floor.
 *  `interactive` gates room clicks (off for the ambient / guest-map presentations);
 *  `highlight` is the set of AI-recommended room ids that glow in Pyramid OS lime. */
export function FloorSpaces({
  floorId,
  interactive = true,
  highlight,
  liveEvents,
}: {
  floorId: number | "park";
  interactive?: boolean;
  highlight?: Set<string>;
  /** live events keyed by pyramid room id — rooms in this map get a LIVE pin */
  liveEvents?: Map<string, LiveEventMarker>;
}) {
  const floor = getFloor(floorId);
  const selectSpaceRaw = usePyramid((s) => s.selectSpace);
  const selectSpace = interactive ? selectSpaceRaw : () => {};
  if (!floor) return null;

  return (
    <group>
      {/* soft daylight park: near-white ground, greenery ring, walkways, trees */}
      <ParkEnvironment />

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
        const recommended = !!highlight?.has(space.id);
        const live = liveEvents?.get(space.id);
        return space.stairs ? (
          <StairsSpace key={space.id} space={space} index={i} interactive={interactive} recommended={recommended} live={live} onSelect={() => selectSpace(space.id)} />
        ) : (
          <SpaceCube key={space.id} space={space} index={i} lift={lifted ? STORY : 0} interactive={interactive} recommended={recommended} live={live} onSelect={() => selectSpace(space.id)} />
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

/** Soft daylight park around the building plate: a near-white ground, a subtle
 *  greenery ring, faint radial walkways and a low-poly tree ring — echoing the
 *  real aerial while keeping the cubes the focus. Kept cheap (instanced trees,
 *  flat planes). */
function ParkEnvironment() {
  return (
    <group>
      {/* near-white park ground, far beyond the building plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <circleGeometry args={[19, 72]} />
        <meshStandardMaterial color="#e9efe4" roughness={1} metalness={0} />
      </mesh>
      {/* greenery ring band hugging the plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, 0]}>
        <ringGeometry args={[7.9, 15.5, 90]} />
        <meshStandardMaterial color="#d4e3c6" roughness={1} />
      </mesh>
      {/* faint radial walkways crossing the green toward the plate */}
      {Array.from({ length: 8 }, (_, i) => {
        const ang = (i / 8) * 360 + 22.5;
        const r0 = 7.9;
        const r1 = 15.0;
        const len = r1 - r0;
        const cr = (r0 + r1) / 2;
        const rad = (ang * Math.PI) / 180;
        return (
          <group key={i} position={[Math.cos(rad) * cr, -0.045, Math.sin(rad) * cr]} rotation={[0, faceRotY(ang), 0]}>
            <mesh receiveShadow>
              <boxGeometry args={[1.05, 0.02, len]} />
              <meshStandardMaterial color="#eef2ec" roughness={1} />
            </mesh>
          </group>
        );
      })}
      <TreeRing />
    </group>
  );
}

/** Instanced low-poly trees (2 draw calls): a trunk + a flat-shaded canopy. */
function TreeRing() {
  return (
    <group>
      <Instances limit={TREES.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.5, 6]} />
        <meshStandardMaterial color="#977a52" roughness={1} />
        {TREES.map((t, i) => (
          <Instance key={i} position={[t.x, 0.25 * t.s, t.z]} scale={t.s} rotation={[0, t.ry, 0]} />
        ))}
      </Instances>
      <Instances limit={TREES.length} castShadow>
        <icosahedronGeometry args={[0.52, 0]} />
        <meshStandardMaterial roughness={0.92} flatShading />
        {TREES.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, 0.84 * t.s, t.z]}
            scale={t.s * (0.9 + t.tint * 0.25)}
            rotation={[t.tint * 2.2, t.ry, t.tint * 1.3]}
            color={LEAF_LIGHT.clone().lerp(LEAF_DARK, t.tint)}
          />
        ))}
      </Instances>
    </group>
  );
}

/** One stylized window: a light trim plane, a glass pane and a thin mullion.
 *  Oriented in its own group so local +z is the outward wall normal. */
function FacadeWindow({ ww, wh }: { ww: number; wh: number }) {
  return (
    <>
      <mesh>
        <planeGeometry args={[ww * 1.22, wh * 1.18]} />
        <meshStandardMaterial color={TRIM} roughness={0.85} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[ww, wh]} />
        <meshStandardMaterial color={GLASS} roughness={0.18} metalness={0.45} emissive={GLASS} emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.007]}>
        <planeGeometry args={[ww * 0.07, wh]} />
        <meshStandardMaterial color={TRIM} roughness={0.85} />
      </mesh>
    </>
  );
}

/** Parametric cabin facade: a door on the atrium-facing wall plus window panes
 *  on the side + back walls. Fully derived from [w,h,d] and built from flat
 *  planes flush on the surface, so it scales to every block and NEVER changes
 *  the block's footprint (the RoundedBox keeps `space.size`). */
function CubeFacade({ w, h, d, color, door = true }: { w: number; h: number; d: number; color: string; door?: boolean }) {
  const eps = 0.016;
  const panel = useMemo(() => darken(color, 0.5), [color]);
  const winY = h * 0.03;
  const winH = Math.min(h * 0.34, 0.62);

  // window counts scale with each wall's length
  const sideN = Math.max(1, Math.min(3, Math.round(d / 1.0)));
  const sideW = Math.min(0.34, (d * 0.72) / sideN);
  const sidePos = Array.from({ length: sideN }, (_, i) => (i - (sideN - 1) / 2) * (d / (sideN + 0.5)));

  const backN = Math.max(1, Math.min(3, Math.round(w / 1.0)));
  const backW = Math.min(0.34, (w * 0.72) / backN);
  const backPos = Array.from({ length: backN }, (_, i) => (i - (backN - 1) / 2) * (w / (backN + 0.5)));

  const doorW = Math.min(0.5, w * 0.24);
  const doorH = Math.min(h * 0.52, h - 0.1);

  return (
    <group>
      {/* door — front wall facing the atrium (local -z) */}
      {door && (
        <group position={[0, -h / 2 + doorH / 2 + 0.02, -(d / 2 + eps)]} rotation={[0, Math.PI, 0]}>
          <mesh>
            <planeGeometry args={[doorW * 1.34, doorH * 1.06]} />
            <meshStandardMaterial color={TRIM} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.01, 0.004]}>
            <planeGeometry args={[doorW, doorH]} />
            <meshStandardMaterial color={panel} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[doorW * 0.3, 0, 0.008]}>
            <circleGeometry args={[Math.max(0.018, doorW * 0.05), 14]} />
            <meshStandardMaterial color={TRIM} metalness={0.4} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* side walls (±x) */}
      {sidePos.map((pz, i) => (
        <group key={`px-${i}`} position={[w / 2 + eps, winY, pz]} rotation={[0, Math.PI / 2, 0]}>
          <FacadeWindow ww={sideW} wh={winH} />
        </group>
      ))}
      {sidePos.map((pz, i) => (
        <group key={`nx-${i}`} position={[-(w / 2 + eps), winY, pz]} rotation={[0, -Math.PI / 2, 0]}>
          <FacadeWindow ww={sideW} wh={winH} />
        </group>
      ))}

      {/* back wall (+z) */}
      {backPos.map((px, i) => (
        <group key={`bz-${i}`} position={[px, winY, d / 2 + eps]}>
          <FacadeWindow ww={backW} wh={winH} />
        </group>
      ))}
    </group>
  );
}

/** Floor-0 staircase space — a clean grey climbable flight; click to open the
 *  stair-talk (50 people, screen, no chairs). Modelled after the reference. */
function StairsSpace({ space, onSelect, index = 0, interactive = true, live }: { space: EventSpace; onSelect: () => void; index?: number; interactive?: boolean; recommended?: boolean; live?: LiveEventMarker }) {
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
          if (interactive) document.body.style.cursor = "pointer";
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

      <SpacePin space={space} bookable={!!space.eventable} y={rise * steps + 0.6} onSelect={onSelect} />
      {live && <LiveMarker ev={live} y={rise * steps + 1.62} />}
      </Rise>
    </group>
  );
}

/** A realistic solid tenant block. Sits flat on the floor, or — when `lift` is
 *  set — floats on an upper tier carried by slim columns (two-story floors). */
function SpaceCube({ space, onSelect, lift = 0, index = 0, interactive = true, recommended = false, live }: { space: EventSpace; onSelect: () => void; lift?: number; index?: number; interactive?: boolean; recommended?: boolean; live?: LiveEventMarker }) {
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
          if (interactive) document.body.style.cursor = bookable ? "pointer" : "not-allowed";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <RoundedBox args={space.size} radius={0.1} smoothness={5} castShadow receiveShadow>
          {bookable ? (
            // HERO: vivid, saturated, glossy, with an emissive glow that lifts on hover.
            // AI-recommended rooms glow in Pyramid OS lime so they read as "available
            // & suggested" against the other (neutral-coloured) bookable rooms.
            <meshStandardMaterial
              color={recommended ? ACCENT : space.color}
              roughness={0.34}
              metalness={0.14}
              emissive={recommended ? ACCENT : space.color}
              emissiveIntensity={recommended ? (hover ? 0.7 : 0.5) : hover ? 0.42 : 0.22}
            />
          ) : (
            // CONTEXT: desaturated + lightened, fully opaque so it reads as a
            // quiet building yet recedes against the bright bookable cubes.
            <meshStandardMaterial color={mutedColor(space.color)} roughness={0.82} metalness={0.02} />
          )}
        </RoundedBox>

        {/* cabin facade — door toward the atrium + windows on the other walls */}
        <CubeFacade w={w} h={h} d={d} color={space.color} door={!space.glassFront} />

        {/* faint lime accent rim hugging the base of bookable blocks — draws the eye */}
        {bookable && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -h / 2 + 0.012, 0]}>
            <ringGeometry args={[Math.max(w, d) / 2 + 0.04, Math.max(w, d) / 2 + 0.15, 56]} />
            <meshStandardMaterial
              color={ACCENT}
              emissive={ACCENT}
              emissiveIntensity={recommended ? 1.2 : hover ? 1.0 : 0.65}
              transparent
              opacity={recommended ? 0.95 : hover ? 0.9 : 0.6}
              toneMapped={false}
            />
          </mesh>
        )}

        {/* glazed entry facing the atrium (local -z faces the centre) */}
        {space.glassFront && (
          <mesh position={[0, -space.size[1] * 0.12, -space.size[2] / 2 - 0.02]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[space.size[0] * 0.6, space.size[1] * 0.62]} />
            <meshStandardMaterial color="#bfe3ff" transparent opacity={0.5} roughness={0.1} metalness={0.4} />
          </mesh>
        )}
      </group>

      <SpacePin space={space} bookable={bookable} y={space.size[1] / 2 + 0.6} onSelect={onSelect} />
      {live && <LiveMarker ev={live} y={space.size[1] / 2 + 1.62} />}
      </Rise>
    </group>
  );
}
