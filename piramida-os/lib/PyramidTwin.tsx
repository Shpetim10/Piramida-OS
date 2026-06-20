"use client";

import { useId, type ReactNode } from "react";

interface TwinRoom {
  id: string;
  name: string;
  cap: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: string;
}

const ROOMS: TwinRoom[] = [
  { id: "common", name: "Common Area", cap: "250", x: 236, y: 150, w: 128, h: 48, status: "available" },
  { id: "green", name: "Green Room", cap: "180", x: 182, y: 218, w: 112, h: 58, status: "available" },
  { id: "yellow", name: "Yellow Room", cap: "80", x: 306, y: 218, w: 112, h: 58, status: "available" },
  { id: "blue", name: "Blue Room", cap: "120", x: 128, y: 300, w: 158, h: 54, status: "available" },
  { id: "orange", name: "Orange Room", cap: "90", x: 314, y: 300, w: 158, h: 54, status: "available" },
  { id: "entrance", name: "Entrance", cap: "—", x: 262, y: 360, w: 76, h: 24, status: "available" },
];

const A = "#C8F000";
const LINE = "#39414F";
const SOFT = "#222834";
const MUT = "#7D8799";

export interface PyramidTwinProps {
  selected?: string[];
  showRoutes?: boolean;
  labels?: boolean;
  hero?: boolean;
  onRoom?: (id: string) => void;
}

export function PyramidTwin({
  selected = [],
  showRoutes = true,
  labels = true,
  hero = false,
  onRoom,
}: PyramidTwinProps) {
  // Unique ids so multiple pyramids on one page never share filter/gradient defs.
  const raw = useId().replace(/[:]/g, "");
  const glowId = `pglow-${raw}`;
  const gradId = `prg-${raw}`;

  const xL = (y: number) => 66 + ((384 - y) / 338) * 230;
  const xR = (y: number) => 534 - ((384 - y) / 338) * 230;

  const ch: ReactNode[] = [];

  ch.push(
    <defs key="defs">
      <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="rgba(200,240,0,.22)" />
        <stop offset="1" stopColor="rgba(200,240,0,.04)" />
      </linearGradient>
    </defs>
  );

  ch.push(<polygon key="back" points="314,40 84,374 552,374" fill="none" stroke={SOFT} strokeWidth={1} />);
  ch.push(<line key="da" x1={300} y1={46} x2={314} y2={40} stroke={SOFT} strokeWidth={1} />);
  ch.push(<line key="db" x1={66} y1={384} x2={84} y2={374} stroke={SOFT} strokeWidth={1} />);
  ch.push(<line key="dc" x1={534} y1={384} x2={552} y2={374} stroke={SOFT} strokeWidth={1} />);
  ch.push(<line key="gl" x1={50} y1={384} x2={560} y2={384} stroke={LINE} strokeWidth={1.2} />);

  [136, 200, 268, 332].forEach((y, i) =>
    ch.push(
      <line key={`s${i}`} x1={xL(y)} y1={y} x2={xR(y)} y2={y} stroke={SOFT} strokeWidth={1} strokeDasharray="1 7" />
    )
  );

  ch.push(<polygon key="front" points="300,46 66,384 534,384" fill="none" stroke={LINE} strokeWidth={1.6} />);

  if (showRoutes) {
    const cen = (r: TwinRoom) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const ent = ROOMS.find((r) => r.id === "entrance")!;
    const e = cen(ent);
    ["green", "blue", "yellow", "common"]
      .filter((id) => selected.includes(id))
      .forEach((id) => {
        const r = ROOMS.find((x) => x.id === id);
        if (!r) return;
        const c = cen(r);
        const mx = (e.x + c.x) / 2;
        const my = Math.min(e.y, c.y) - 34;
        ch.push(
          <path
            key={`rt${id}`}
            d={`M${e.x} ${e.y} Q ${mx} ${my} ${c.x} ${c.y}`}
            fill="none"
            stroke={A}
            strokeWidth={1.4}
            strokeDasharray="2 6"
            opacity={0.7}
            style={{ animation: "dashFlow 1.1s linear infinite" }}
          />
        );
      });
  }

  ROOMS.forEach((r) => {
    const active = selected.includes(r.id);
    let fill = "#1A1F2B";
    let stroke = LINE;
    let dash: string | undefined;
    let txt = MUT;
    if (r.status === "available") {
      fill = "none";
      stroke = LINE;
      dash = "3 4";
    }
    if (active) {
      fill = `url(#${gradId})`;
      stroke = A;
      txt = A;
      dash = undefined;
    }
    const clickProps = onRoom
      ? { onClick: () => onRoom(r.id), style: { cursor: "pointer" } as const }
      : {};

    ch.push(
      <rect
        key={`${r.id}b`}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        rx={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={active ? 1.6 : 1.1}
        strokeDasharray={dash}
        filter={active ? `url(#${glowId})` : undefined}
        onClick={onRoom ? () => onRoom(r.id) : undefined}
        style={
          active
            ? { animation: "glowPulse 2.6s ease-in-out infinite", cursor: onRoom ? "pointer" : undefined }
            : (clickProps.style as React.CSSProperties | undefined)
        }
      />
    );
    if (active) {
      ch.push(
        <rect
          key={`${r.id}h`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={4}
          fill="none"
          stroke={A}
          strokeWidth={1.6}
          onClick={onRoom ? () => onRoom(r.id) : undefined}
          style={onRoom ? { cursor: "pointer" } : undefined}
        />
      );
    }
    if (labels && !hero) {
      ch.push(
        <text
          key={`${r.id}t`}
          x={r.x + 9}
          y={r.y + (r.h > 30 ? 20 : 15)}
          fill={txt}
          style={{ font: "600 11px 'JetBrains Mono', monospace" }}
        >
          {r.name}
        </text>
      );
      if (r.cap) {
        ch.push(
          <text
            key={`${r.id}c`}
            x={r.x + 9}
            y={r.y + r.h - 9}
            fill={active ? "rgba(200,240,0,.7)" : MUT}
            style={{ font: "500 9px 'JetBrains Mono', monospace" }}
          >
            {r.cap === "—" ? "LOBBY" : `CAP ${r.cap}`}
          </text>
        );
      }
    }
  });

  ch.push(
    <circle
      key="apex"
      cx={300}
      cy={46}
      r={hero ? 4 : 3}
      fill="#D6FF00"
      filter={`url(#${glowId})`}
      style={{ animation: "glowPulse 3s ease-in-out infinite" }}
    />
  );

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 600 470"
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
    >
      {ch}
    </svg>
  );
}
