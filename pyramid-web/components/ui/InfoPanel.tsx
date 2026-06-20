"use client";

import { usePyramid, useResolvedEvent } from "@/lib/store";
import { getFloor, getSpace, type Layout } from "@/lib/pyramid-data";

const LAYOUTS: Layout[] = ["theater", "classroom", "banquet", "standing"];

export function InfoPanel() {
  const { view, floorId, spaceId, back, updateEvent } = usePyramid();
  const space = floorId != null && spaceId ? getSpace(floorId, spaceId) : undefined;
  const event = useResolvedEvent(spaceId, space?.event);
  const floor = floorId != null ? getFloor(floorId) : undefined;

  if (view !== "interior" || !space) return null;

  const minC = space.minChairs ?? 0;
  const maxC = space.maxChairs ?? 200;
  const clamp = (n: number) => Math.max(minC, Math.min(maxC, n));

  const capacity =
    space.stairs && event?.seats != null
      ? event.seats
      : event?.layout === "banquet"
        ? (event.tables ?? Math.ceil((event.chairs || 0) / 8)) * 8
        : event?.chairs ?? 0;

  return (
    <aside className="info-panel">
      <button className="back-btn" onClick={back}>
        ← {floor?.name}
      </button>

      <div className="info-accent" style={{ background: space.color }} />
      <h2>{space.name}</h2>

      {/* Non-bookable tenant space */}
      {!space.eventable ? (
        <p className="empty">This space is a tenant area and doesn’t host bookable events.</p>
      ) : space.stairs ? (
        // Fixed stair-talk: 50 people on the steps, with a screen
        <>
          <div className="info-row">
            <span className="info-title">{event?.title ?? "Stair Talk"}</span>
            <span className={`status status-${event?.status ?? "scheduled"}`}>{event?.status ?? "scheduled"}</span>
          </div>
          {event?.date && <div className="info-meta">📅 {event.date}</div>}
          <p className="empty">Seating on the steps — no chairs. Includes a presentation screen.</p>
          <div className="capacity">
            Capacity ≈ <strong>{capacity}</strong>
          </div>
        </>
      ) : event ? (
        <>
          <div className="info-row">
            <span className="info-title">{event.title}</span>
            <span className={`status status-${event.status}`}>{event.status}</span>
          </div>
          {event.date && <div className="info-meta">📅 {event.date}</div>}

          <div className="field">
            <label>Layout</label>
            <div className="seg">
              {LAYOUTS.map((l) => (
                <button key={l} className={event.layout === l ? "on" : ""} onClick={() => updateEvent(space.id, { layout: l })}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {event.layout !== "standing" && (
            <div className="field">
              <label>
                Chairs <strong>{event.chairs}</strong> <span className="muted">({minC}–{maxC})</span>
              </label>
              <input
                type="range"
                min={minC}
                max={maxC}
                step={2}
                value={clamp(event.chairs)}
                onChange={(e) => updateEvent(space.id, { chairs: clamp(Number(e.target.value)) })}
              />
              <div className="nudge">
                {[-10, -2, +2, +10].map((d) => (
                  <button key={d} onClick={() => updateEvent(space.id, { chairs: clamp(event.chairs + d) })}>
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {event.layout === "banquet" && (
            <div className="field">
              <label>
                Round tables <strong>{event.tables ?? Math.ceil(event.chairs / 8)}</strong>
              </label>
              <input
                type="range"
                min={1}
                max={Math.max(1, Math.ceil(maxC / 8))}
                value={event.tables ?? Math.ceil(event.chairs / 8)}
                onChange={(e) => updateEvent(space.id, { tables: Number(e.target.value) })}
              />
            </div>
          )}

          <div className="capacity">
            Capacity ≈ <strong>{capacity}</strong>
          </div>
        </>
      ) : (
        <>
          <p className="empty">No event scheduled here yet. Pick a layout to start planning:</p>
          <div className="seg">
            {LAYOUTS.map((l) => (
              <button
                key={l}
                onClick={() => updateEvent(space.id, { layout: l, chairs: l === "standing" ? 0 : clamp(minC || 20), title: "New event", status: "draft" })}
              >
                {l}
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
