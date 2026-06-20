"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { usePyramid } from "@/lib/store";
import { getFloor } from "@/lib/pyramid-data";
import { FloorSelector } from "./ui/FloorSelector";
import { InfoPanel } from "./ui/InfoPanel";

// r3f must run client-side only
const Scene = dynamic(() => import("./three/Scene"), {
  ssr: false,
  loading: () => <div className="loading">Loading the Pyramid…</div>,
});

export default function PyramidApp() {
  const { view, floorId } = usePyramid();
  const floor = floorId != null ? getFloor(floorId) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▲</span> Piramida Tirana · <span className="brand-sub">Event Manager</span>
        </div>
        <div className="crumbs">
          {view === "exterior" && "Exterior — pick a floor"}
          {view === "floor" && `${floor?.name} — tap a space`}
          {view === "interior" && `Editing event layout`}
        </div>
      </header>

      <div className="canvas-wrap">
        <Suspense fallback={<div className="loading">Loading…</div>}>
          <Scene />
        </Suspense>
      </div>

      <FloorSelector />
      <InfoPanel />
    </div>
  );
}
