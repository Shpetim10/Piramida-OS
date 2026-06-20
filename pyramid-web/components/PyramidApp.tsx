"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { usePyramid } from "@/lib/store";
import { getFloor } from "@/lib/pyramid-data";
import { FloorSelector } from "./ui/FloorSelector";
import { FloorNav } from "./ui/FloorNav";
import { FloorLegend } from "./ui/FloorLegend";
import { InfoPanel } from "./ui/InfoPanel";

// r3f must run client-side only
const Scene = dynamic(() => import("./three/Scene"), {
  ssr: false,
  loading: () => <div className="loading">Loading the Pyramid…</div>,
});

export default function PyramidApp() {
  const { view, floorId, spaceId, explode, reset } = usePyramid();
  const floor = floorId != null ? getFloor(floorId) : undefined;

  return (
    <div className="app">
      {/* Quick veil + lime scan-sweep that replays on every scene change,
          masking the React content swap and selling the transition. */}
      <div key={`${view}:${floorId}:${spaceId}`} className="scene-transition" aria-hidden />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▲</span> Piramida Tirana · <span className="brand-sub">Event Manager</span>
        </div>
        <div className="crumbs">
          {view === "exterior" && "2026 Site — pick a floor"}
          {view === "floor" && `${floor?.name} — tap a space`}
          {view === "interior" && `Editing event layout`}
          {view === "exploded" && "Sliced view — tap a level"}
        </div>
      </header>

      <div className="canvas-wrap">
        <Suspense fallback={<div className="loading">Loading…</div>}>
          <Scene />
        </Suspense>
      </div>

      <FloorSelector />
      <FloorNav />
      <FloorLegend />
      <InfoPanel />

      {/* Toggle the exploded "sliced pyramid" overview from the exterior. */}
      {(view === "exterior" || view === "exploded") && (
        <button
          className={`view-toggle ${view === "exploded" ? "on" : ""}`}
          onClick={() => (view === "exploded" ? reset() : explode())}
        >
          <span className="view-toggle-icon" aria-hidden>
            ◤
          </span>
          {view === "exploded" ? "Exit sliced view" : "Sliced view"}
        </button>
      )}

      {/* Real-world geometry: the exterior is a live OpenStreetMap extract. */}
      {view === "exterior" && (
        <a
          className="map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer noopener"
        >
          Site geometry © OpenStreetMap contributors
        </a>
      )}
    </div>
  );
}
