"use client";

// 2.5D Pyramid Twin + readiness ring + DNA radar + decision graph.
// Ported verbatim from the Manager Command Center Claude Design source so the
// visual language matches exactly. Pure presentational SVG — no data fetching.

import { TWIN_ROOMS, zoneLabel, occColor } from "@/lib/manager/data";

type Layer = "allocation" | "occupancy" | "flow" | "setup";

export function PyramidTwin({
  selected = [],
  layer = "allocation",
  occ = {},
  focus,
  onRoom,
}: {
  selected?: string[];
  layer?: Layer;
  occ?: Record<string, number>;
  focus?: string;
  onRoom?: (id: string) => void;
}) {
  const A = "#D6FF00";
  const LINE = "#39414F";
  const SOFT = "#222834";
  const MUT = "#7D8799";
  const rooms = TWIN_ROOMS;
  const xL = (y: number) => 66 + ((384 - y) / 338) * 230;
  const xR = (y: number) => 534 - ((384 - y) / 338) * 230;
  const clickable = !!onRoom;
  const ch: React.ReactNode[] = [];

  ch.push(
    <defs key="d">
      <filter id="pglow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="prg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="rgba(214,255,0,.22)" />
        <stop offset="1" stopColor="rgba(214,255,0,.04)" />
      </linearGradient>
    </defs>
  );
  ch.push(<polygon key="back" points="314,40 84,374 552,374" fill="none" stroke={SOFT} strokeWidth={1} />);
  ch.push(<line key="gl" x1={50} y1={384} x2={560} y2={384} stroke={LINE} strokeWidth={1.2} />);
  [136, 200, 268, 332].forEach((y, i) =>
    ch.push(<line key={"s" + i} x1={xL(y)} y1={y} x2={xR(y)} y2={y} stroke={SOFT} strokeWidth={1} strokeDasharray="1 7" />)
  );
  ch.push(<polygon key="front" points="300,46 66,384 534,384" fill="none" stroke={LINE} strokeWidth={1.6} />);

  if (layer === "flow" || layer === "allocation") {
    const cen = (r: (typeof rooms)[number]) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const ent = rooms.find((r) => r.id === "entrance")!;
    const e = cen(ent);
    ["green", "blue", "yellow", "common"]
      .filter((id) => selected.includes(id))
      .forEach((id) => {
        const r = rooms.find((x) => x.id === id);
        if (!r) return;
        const c = cen(r);
        const mx = (e.x + c.x) / 2;
        const my = Math.min(e.y, c.y) - 34;
        ch.push(
          <path
            key={"rt" + id}
            d={"M" + e.x + " " + e.y + " Q " + mx + " " + my + " " + c.x + " " + c.y}
            fill="none"
            stroke={A}
            strokeWidth={layer === "flow" ? 1.8 : 1.2}
            strokeDasharray="2 6"
            opacity={layer === "flow" ? 0.85 : 0.55}
            style={{ animation: "dashFlow 1.1s linear infinite" }}
          />
        );
      });
  }

  rooms.forEach((r) => {
    const active = selected.includes(r.id);
    const p = occ[r.id] || 0;
    let fill = "none";
    let stroke = LINE;
    let dash: string | undefined = "3 4";
    let txt = MUT;
    if (active) {
      fill = "url(#prg)";
      stroke = A;
      txt = A;
      dash = undefined;
    }
    if (layer === "occupancy" && active) {
      const oc = occColor(p);
      fill = oc + "22";
      stroke = oc;
      txt = oc;
    }
    const isFocus = focus === r.id;
    const evt = clickable ? { onClick: () => onRoom!(r.id), style: { cursor: "pointer" } } : {};
    const glowing = active && layer === "allocation";
    ch.push(
      <rect
        key={r.id + "b"}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        rx={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={active ? 1.6 : 1.1}
        strokeDasharray={dash}
        filter={active && layer !== "occupancy" ? "url(#pglow)" : undefined}
        onClick={clickable ? () => onRoom!(r.id) : undefined}
        style={
          glowing
            ? { animation: "glowPulse 2.6s ease-in-out infinite", ...(evt as { style?: React.CSSProperties }).style }
            : (evt as { style?: React.CSSProperties }).style
        }
      />
    );
    if (isFocus) {
      ch.push(
        <rect
          key={r.id + "f"}
          x={r.x - 4}
          y={r.y - 4}
          width={r.w + 8}
          height={r.h + 8}
          rx={7}
          fill="none"
          stroke="#fff"
          strokeWidth={1.4}
          strokeDasharray="4 4"
          onClick={clickable ? () => onRoom!(r.id) : undefined}
          style={clickable ? { cursor: "pointer" } : undefined}
        />
      );
    }
    ch.push(
      <text
        key={r.id + "t"}
        x={r.x + 9}
        y={r.y + (r.h > 30 ? 19 : 15)}
        fill={txt}
        style={{ font: "600 11px 'JetBrains Mono',monospace", pointerEvents: "none" }}
      >
        {r.name}
      </text>
    );
    if (r.h > 30) {
      if (layer === "occupancy" && active) {
        ch.push(
          <text
            key={r.id + "o"}
            x={r.x + r.w - 10}
            y={r.y + r.h - 10}
            textAnchor="end"
            fill={occColor(p)}
            style={{ font: "700 13px 'JetBrains Mono',monospace", pointerEvents: "none" }}
          >
            {p}%
          </text>
        );
      } else if (layer === "setup" && active) {
        ch.push(
          <text
            key={r.id + "z"}
            x={r.x + 9}
            y={r.y + r.h - 9}
            fill="rgba(214,255,0,.7)"
            style={{ font: "500 8px 'JetBrains Mono',monospace", pointerEvents: "none" }}
          >
            {zoneLabel(r.id)}
          </text>
        );
      } else if (r.cap) {
        ch.push(
          <text
            key={r.id + "c"}
            x={r.x + 9}
            y={r.y + r.h - 9}
            fill={active ? "rgba(214,255,0,.7)" : MUT}
            style={{ font: "500 9px 'JetBrains Mono',monospace", pointerEvents: "none" }}
          >
            {r.cap === "—" ? "LOBBY" : "CAP " + r.cap}
          </text>
        );
      }
    }
  });

  ch.push(
    <circle key="apex" cx={300} cy={46} r={3.5} fill={A} filter="url(#pglow)" style={{ animation: "glowPulse 3s ease-in-out infinite" }} />
  );

  return (
    <svg width="100%" height="100%" viewBox="0 0 600 470" preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      {ch}
    </svg>
  );
}

export function ReadinessRing({ pct, color }: { pct: number; color: string }) {
  const r = 86;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <svg width="100%" height="100%" viewBox="0 0 200 200">
      <circle cx={100} cy={100} r={r} fill="none" stroke="#1A1F2B" strokeWidth={12} />
      <circle
        cx={100}
        cy={100}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 100 100)"
        style={{ transition: "stroke-dashoffset .6s ease", filter: "drop-shadow(0 0 6px " + color + "66)" }}
      />
    </svg>
  );
}

export function DnaRadar({ dims }: { dims: { s: string; v: number }[] }) {
  const cx = 150;
  const cy = 120;
  const R = 88;
  const N = dims.length;
  const pt = (i: number, rad: number): [number, number] => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
  };
  const ch: React.ReactNode[] = [];
  [0.25, 0.5, 0.75, 1].forEach((g, gi) => {
    const pts = dims.map((_, i) => pt(i, R * g).join(",")).join(" ");
    ch.push(<polygon key={"g" + gi} points={pts} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={1} />);
  });
  dims.forEach((_, i) => {
    const [x, y] = pt(i, R);
    ch.push(<line key={"a" + i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,.06)" strokeWidth={1} />);
  });
  const vpts = dims.map((d, i) => pt(i, (R * d.v) / 100).join(",")).join(" ");
  ch.push(<polygon key="val" points={vpts} fill="rgba(214,255,0,.16)" stroke="#D6FF00" strokeWidth={1.8} strokeLinejoin="round" />);
  dims.forEach((d, i) => {
    const [x, y] = pt(i, (R * d.v) / 100);
    ch.push(<circle key={"p" + i} cx={x} cy={y} r={2.6} fill="#D6FF00" />);
  });
  dims.forEach((d, i) => {
    const [x, y] = pt(i, R + 15);
    ch.push(
      <text
        key={"l" + i}
        x={x}
        y={y}
        textAnchor={Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end"}
        dominantBaseline="middle"
        fill="#7D8799"
        style={{ font: "600 7.5px 'JetBrains Mono',monospace" }}
      >
        {d.s}
      </text>
    );
  });
  return (
    <svg width="100%" height="100%" viewBox="0 0 300 240" preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      {ch}
    </svg>
  );
}

export function DecisionGraph() {
  const A = "#D6FF00";
  const node = (x: number, y: number, w: number, label: string, sub: string, c?: string) => (
    <g key={label}>
      <rect x={x} y={y} width={w} height={46} rx={9} fill="#151821" stroke={c || "rgba(255,255,255,.12)"} strokeWidth={1.3} />
      <text x={x + 13} y={y + 19} fill="#fff" style={{ font: "700 12px Inter,sans-serif" }}>
        {label}
      </text>
      <text x={x + 13} y={y + 34} fill="#7D8799" style={{ font: "500 9px 'JetBrains Mono',monospace" }}>
        {sub}
      </text>
    </g>
  );
  const link = (x1: number, y1: number, x2: number, y2: number, c?: string, key?: string) => (
    <path
      key={key}
      d={"M" + x1 + " " + y1 + " C " + (x1 + 40) + " " + y1 + " " + (x2 - 40) + " " + y2 + " " + x2 + " " + y2}
      fill="none"
      stroke={c || "rgba(255,255,255,.14)"}
      strokeWidth={1.4}
    />
  );
  const reqY = 137;
  const ch: React.ReactNode[] = [];
  ch.push(link(212, reqY, 250, 52, "rgba(214,255,0,.3)", "l1"));
  ch.push(link(212, reqY, 250, 137, "rgba(214,255,0,.3)", "l2"));
  ch.push(link(212, reqY, 250, 222, "rgba(214,255,0,.3)", "l3"));
  [52, 137, 222].forEach((y, i) => ch.push(link(430, y + 23, 470, y + 23, undefined, "lb" + i)));
  ch.push(node(40, reqY - 23, 172, "Raw Request", "180 GUESTS · CONF", A));
  ch.push(node(250, 29, 180, "Keynote stage", "→ GREEN ROOM", "#22C55E"));
  ch.push(node(250, 114, 180, "2 breakout tracks", "→ BLUE + YELLOW", "#2A6FDB"));
  ch.push(node(250, 199, 180, "Networking + catering", "→ COMMON AREA", "#7A4BD6"));
  ch.push(node(470, 29, 150, "AV + livestream", "3 ASSETS"));
  ch.push(node(470, 114, 150, "Mics + projectors", "SUBSTITUTED"));
  ch.push(node(470, 199, 150, "QR registration", "→ ENTRANCE"));
  return (
    <svg width="100%" height="100%" viewBox="0 0 630 270" preserveAspectRatio="xMidYMid meet">
      {ch}
    </svg>
  );
}

// Shared small inline icon used in nav + gates.
export function MgrIcon({ name, color = "currentColor" }: { name: string; color?: string }) {
  const P: Record<string, string> = {
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    requests: "M5 4h11l3 3v13H5zM15 4v4h4M8 13h7M8 17h5",
    events: "M3 5h18v16H3zM3 9.5h18M8 3v4M16 3v4",
    understand: "M3 12h3l2 6 4-14 3 9h6",
    simulate: "M12 3l8 4.6v8.8L12 21l-8-4.6V7.6zM4 7.6l8 4.6 8-4.6M12 12.2V21",
    protect: "M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z",
    explain: "M6 18a2 2 0 100-4 2 2 0 000 4zM18 7a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4zM7.6 15.3l8.8-5M16.4 16.2l-8.8-1.4",
    launch: "M12 3c3 2.4 4.6 6 4.6 9.4L14 16h-4l-2.6-3.6C7.4 9 9 5.4 12 3zM9.5 17l-2 4M14.5 17l2 4",
    tasks: "M4 7l2 2 4-4M4 17l2 2 4-4M14 7h6M14 17h6",
    spaces: "M4 21V8l8-5 8 5v13M4 21h16M9 21v-6h6v6",
    inventory: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
    check: "M4 12l5 5L20 6",
    warn: "M12 8v5M12 17v.5",
    x: "M6 6l12 12M18 6L6 18",
  };
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name] || ""} />
    </svg>
  );
}
