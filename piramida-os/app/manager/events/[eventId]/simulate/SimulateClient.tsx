"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { DnaRadar, PyramidTwin } from "@/components/manager/twin";
import { LIME, LAYER_DEF, LAYER_META, occColor, fmt } from "@/lib/manager/data";
import type { SpaceScore } from "@/lib/services/planning";

const A = LIME;

type TwinLayer = "allocation" | "occupancy" | "flow" | "setup";

interface TwinRoomDef {
  slug: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

type LatestPlan = {
  selectedSpaces?: Array<{ spaceId: string; name: string; suggestedRole: string; score: number; capacity: number | null; roleKey: string; reasons: string[] }>;
  assetPlan?: { lines: Array<{ categoryName?: string; required?: number; reserved?: number; shortage?: number }>; shortages: Array<{ category: string; required: number; reserved: number; shortBy: number }> };
  dnaScores?: Array<{ key: string; label: string; shortLabel: string; value: number }>;
  feasibility?: { score: number; components: Record<string, number> };
  quote?: { currency: string; total: number; items: Array<{ label: string; category: string; lineTotal: number; sourceRef: string }> };
  manualWorkSavings?: { stepsSaved: number; hoursSaved: number; drivers: string[] };
};

interface Props {
  eventId: string;
  spaceScores: SpaceScore[];
  allocatedIds: string[];
  guests: number;
  roomPositions: TwinRoomDef[];
  latestPlan: LatestPlan | null;
}

type SpaceInfo = {
  price?: {
    total: number;
    currency: string;
    billedHours: number;
    featureSurcharges: Array<{ label: string; amount: number }>;
    breakdown: string[];
  } | null;
  quoteLine?: { label: string; lineTotal: number } | null;
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function SimulateClient({ eventId, spaceScores, allocatedIds, guests, roomPositions, latestPlan }: Props) {
  const router = useRouter();
  const { isMobile } = useMgrViewport();
  const [isGenerating, startGenerating] = useTransition();
  const [twinLayer, setTwinLayer] = useState<TwinLayer>("allocation");
  const [focusRoom, setFocusRoom] = useState<string>(roomPositions[1]?.slug ?? roomPositions[0]?.slug ?? "");
  const [roomInfo, setRoomInfo] = useState<SpaceInfo | null>(null);

  const scoreBySlug = useMemo(() => new Map(spaceScores.map((score) => [slugify(score.name), score])), [spaceScores]);
  const scoreById = useMemo(() => new Map(spaceScores.map((score) => [score.spaceId, score])), [spaceScores]);
  const roomBySlug = useMemo(() => new Map(roomPositions.map((room) => [room.slug, room])), [roomPositions]);

  const selectedIds = latestPlan?.selectedSpaces?.map((space) => space.spaceId) ?? allocatedIds;
  const selectedSlugs = selectedIds.map((id) => scoreById.get(id)).filter(Boolean).map((score) => slugify(score!.name));
  const focusScore = scoreBySlug.get(focusRoom);
  const focusRoomPosition = roomBySlug.get(focusRoom) ?? roomPositions[0];
  const isSelected = focusScore ? selectedIds.includes(focusScore.spaceId) : selectedSlugs.includes(focusRoom);
  const focusOcc = focusScore && guests > 0 && focusScore.capacity ? Math.round((guests / focusScore.capacity) * 100) : 0;
  const focusOccColor = occColor(focusOcc);
  const simCols = isMobile ? "1fr" : "1.35fr .95fr";
  const layerMeta = LAYER_META[twinLayer];

  useEffect(() => {
    if (!focusScore?.spaceId) {
      return;
    }
    let cancelled = false;
    fetch(`/api/staff/spaces/${focusScore.spaceId}/info?eventId=${eventId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!cancelled) setRoomInfo(json);
      })
      .catch(() => {
        if (!cancelled) setRoomInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, focusScore?.spaceId]);

  function generatePlan() {
    startGenerating(async () => {
      await fetch(`/api/staff/events/${eventId}/plan`, { method: "POST" });
      router.refresh();
    });
  }

  const twinRooms = roomPositions.map((room) => {
    const score = scoreBySlug.get(room.slug);
    return { id: room.slug, name: room.name, cap: score?.capacity ? String(score.capacity) : "", x: room.x, y: room.y, w: room.w, h: room.h };
  });
  const twinOcc = Object.fromEntries(roomPositions.map((room) => {
    const score = scoreBySlug.get(room.slug);
    const occ = score?.capacity && guests > 0 ? Math.min(100, Math.round((guests / score.capacity) * 100)) : 0;
    return [room.slug, occ];
  }));
  const selectedCapacity = selectedIds.reduce((sum, id) => sum + (scoreById.get(id)?.capacity ?? 0), 0);

  return (
    <ScreenContainer>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginRight: 4 }}>TWIN LAYER</span>
          {LAYER_DEF.map((layer) => {
            const active = twinLayer === layer.id;
            return (
              <button key={layer.id} onClick={() => setTwinLayer(layer.id as TwinLayer)} style={{ padding: "9px 15px", borderRadius: 7, border: `1px solid ${active ? A : "rgba(255,255,255,.1)"}`, background: active ? A : "transparent", color: active ? "#0D0D12" : "#AEB5C2", font: "600 12px Inter, sans-serif", cursor: "pointer" }}>
                {layer.label}
              </button>
            );
          })}
        </div>
        <button onClick={generatePlan} disabled={isGenerating} style={{ border: "none", borderRadius: 7, background: A, color: "#0D0D12", padding: "11px 16px", font: "800 12px Inter, sans-serif", cursor: isGenerating ? "wait" : "pointer" }}>
          {isGenerating ? "Generating..." : "Generate Plan"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: simCols, gap: 18, alignItems: "start" }}>
        <div style={{ position: "relative", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, background: "radial-gradient(780px 520px at 50% 24%,rgba(214,255,0,.07),#0B0E13)", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "34px 34px", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 16, left: 16, padding: "8px 13px", borderRadius: 7, background: "rgba(13,13,18,.72)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>{layerMeta[0]}</div>
            <div style={{ font: "700 12px Inter, sans-serif", color: "#fff", marginTop: 3 }}>{layerMeta[1]}</div>
          </div>
          <div style={{ position: "absolute", top: 16, right: 16, textAlign: "right", padding: "8px 13px", borderRadius: 7, background: "rgba(13,13,18,.72)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>PLAN CAPACITY</div>
            <div style={{ font: "800 16px/1 Inter, sans-serif", color: "#D6FF00", marginTop: 3 }}>{fmt(selectedCapacity)}<span style={{ fontSize: 11, color: "#7D8799" }}> / {guests}</span></div>
          </div>
          <div style={{ height: "clamp(420px,52vh,580px)", padding: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PyramidTwin selected={selectedSlugs} layer={twinLayer} occ={twinOcc} focus={focusRoom} onRoom={setFocusRoom} rooms={twinRooms} />
          </div>
          <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799" }}>Open a room to inspect grounded reasons and live pricing</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RoomInspectCard room={focusRoomPosition} score={focusScore} selected={isSelected} occupancy={focusOcc} occupancyColor={focusOccColor} info={roomInfo} />
          <PlanStats latestPlan={latestPlan} selectedCount={selectedIds.length} quoteTotal={latestPlan?.quote?.total ?? 0} quoteCurrency={latestPlan?.quote?.currency ?? "ALL"} />
          <SpaceMatchCards spaceScores={spaceScores} selectedIds={selectedIds} onFocus={(slug) => setFocusRoom(slug)} />
          <InventoryPlanner latestPlan={latestPlan} />
          <EventDNACard latestPlan={latestPlan} />
        </div>
      </div>
    </ScreenContainer>
  );
}

function RoomInspectCard({ room, score, selected, occupancy, occupancyColor, info }: { room?: TwinRoomDef; score?: SpaceScore; selected: boolean; occupancy: number; occupancyColor: string; info: SpaceInfo | null }) {
  const price = info?.price;
  return (
    <section style={{ border: "1px solid rgba(214,255,0,.24)", borderRadius: 8, background: "radial-gradient(420px 240px at 100% 0%,rgba(214,255,0,.07),#151821)", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ font: "800 17px Inter, sans-serif", color: "#fff" }}>{room?.name ?? "Room"}</div>
          <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: selected ? A : "#7D8799", marginTop: 4 }}>{score?.suggestedRole ?? "No role yet"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ font: "800 18px/1 Inter, sans-serif", color: A }}>{score?.score ?? 0}</div>
          <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>SCORE</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 13 }}>
        <Metric label="CAP" value={String(score?.capacity ?? "-")} color="#fff" />
        <Metric label="OCC" value={`${occupancy}%`} color={occupancyColor} />
        <Metric label="PRICE" value={price ? `${fmt(price.total)} ${price.currency}` : "-"} color={A} />
      </div>
      <div style={{ padding: 12, border: "1px solid rgba(255,255,255,.08)", borderRadius: 7, background: "#0F1218", marginBottom: 10 }}>
        <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: A, letterSpacing: ".1em", marginBottom: 7 }}>WHY SUGGESTED</div>
        {(score?.reasons ?? ["Generate a plan to see grounded room reasoning."]).map((reason) => (
          <div key={reason} style={{ font: "400 12px/1.55 Inter, sans-serif", color: "#E6E9EF", marginBottom: 5 }}>{reason}</div>
        ))}
      </div>
      {price && (
        <div style={{ padding: 12, border: "1px solid rgba(255,255,255,.08)", borderRadius: 7, background: "#0F1218" }}>
          <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 7 }}>PRICE BREAKDOWN</div>
          {price.breakdown.concat(price.featureSurcharges.map((item) => `${item.label}: ${fmt(item.amount)} ${price.currency}`)).slice(0, 4).map((line) => (
            <div key={line} style={{ font: "500 11px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>{line}</div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 10, border: "1px solid rgba(255,255,255,.07)", borderRadius: 7, background: "#0F1218" }}>
      <div style={{ font: "800 15px/1 Inter, sans-serif", color }}>{value}</div>
      <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginTop: 5 }}>{label}</div>
    </div>
  );
}

function PlanStats({ latestPlan, selectedCount, quoteTotal, quoteCurrency }: { latestPlan: LatestPlan | null; selectedCount: number; quoteTotal: number; quoteCurrency: string }) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
      <Metric label="ROOMS" value={String(selectedCount)} color="#fff" />
      <Metric label="FEASIBLE" value={`${latestPlan?.feasibility?.score ?? 0}%`} color={A} />
      <Metric label="QUOTE" value={quoteTotal ? `${fmt(quoteTotal)} ${quoteCurrency}` : "-"} color="#fff" />
      {latestPlan?.manualWorkSavings && (
        <div style={{ gridColumn: "1 / -1", padding: 12, border: "1px solid rgba(42,111,219,.28)", borderRadius: 7, background: "rgba(42,111,219,.07)" }}>
          <div style={{ font: "700 12px Inter, sans-serif", color: "#fff" }}>{latestPlan.manualWorkSavings.hoursSaved} staff hours saved</div>
          <div style={{ font: "500 11px/1.5 Inter, sans-serif", color: "#AEB5C2", marginTop: 3 }}>{latestPlan.manualWorkSavings.stepsSaved} manual checks replaced by deterministic planning.</div>
        </div>
      )}
    </section>
  );
}

function SpaceMatchCards({ spaceScores, selectedIds, onFocus }: { spaceScores: SpaceScore[]; selectedIds: string[]; onFocus: (slug: string) => void }) {
  return (
    <section style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, background: "#151821", padding: 16 }}>
      <div style={{ font: "700 13px Inter, sans-serif", color: "#fff", marginBottom: 11 }}>Space match cards</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {spaceScores.slice(0, 6).map((space) => {
          const selected = selectedIds.includes(space.spaceId);
          return (
            <button key={space.spaceId} onClick={() => onFocus(slugify(space.name))} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 11, border: `1px solid ${selected ? "rgba(200,240,0,.32)" : "rgba(255,255,255,.07)"}`, borderRadius: 7, background: selected ? "rgba(200,240,0,.06)" : "#0F1218", cursor: "pointer" }}>
              <span style={{ width: 34, font: "800 14px Inter, sans-serif", color: selected ? A : "#fff" }}>{space.score}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", font: "700 12px Inter, sans-serif", color: "#fff" }}>{space.name}</span>
                <span style={{ display: "block", font: "500 11px/1.4 Inter, sans-serif", color: "#AEB5C2", marginTop: 2 }}>{space.reasons[0]}</span>
              </span>
              <span style={{ font: "700 9px 'JetBrains Mono', monospace", color: selected ? "#0D0D12" : "#7D8799", background: selected ? A : "#1A1F2B", padding: "4px 7px", borderRadius: 5 }}>{selected ? "PLAN" : space.suggestedRole.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function InventoryPlanner({ latestPlan }: { latestPlan: LatestPlan | null }) {
  const lines = latestPlan?.assetPlan?.lines ?? [];
  const shortages = latestPlan?.assetPlan?.shortages ?? [];
  return (
    <section style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, background: "#151821", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 11 }}>
        <div style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>Inventory planner</div>
        <div style={{ font: "700 10px 'JetBrains Mono', monospace", color: shortages.length ? "#F59E0B" : A }}>{shortages.length} SHORTAGES</div>
      </div>
      {lines.length === 0 ? <div style={{ color: "#7D8799", font: "500 12px Inter, sans-serif" }}>Generate a plan to dry-run assets.</div> : lines.map((line, index) => (
        <div key={`${line.categoryName}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: "8px 0", borderTop: index ? "1px solid rgba(255,255,255,.06)" : "none" }}>
          <div style={{ font: "600 12px Inter, sans-serif", color: "#E6E9EF" }}>{line.categoryName}</div>
          <div style={{ font: "700 11px 'JetBrains Mono', monospace", color: line.shortage ? "#F59E0B" : A }}>{line.reserved ?? 0}/{line.required ?? 0}</div>
        </div>
      ))}
    </section>
  );
}

function EventDNACard({ latestPlan }: { latestPlan: LatestPlan | null }) {
  const dims = latestPlan?.dnaScores ?? [];
  return (
    <section style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, background: "#151821", padding: 16 }}>
      <div style={{ font: "700 13px Inter, sans-serif", color: "#fff", marginBottom: 8 }}>Event DNA</div>
      {dims.length ? (
        <>
          <div style={{ height: 210 }}>
            <DnaRadar dims={dims.map((dim) => ({ s: dim.shortLabel, v: dim.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {dims.map((dim) => <Metric key={dim.key} label={dim.shortLabel} value={String(dim.value)} color={dim.value >= 75 ? A : "#AEB5C2"} />)}
          </div>
        </>
      ) : (
        <div style={{ color: "#7D8799", font: "500 12px Inter, sans-serif" }}>Generate a plan to compute DNA dimensions.</div>
      )}
    </section>
  );
}
