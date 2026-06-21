import { getLiveEvents, type LiveEventMarker } from "@/lib/services/events";
import ExploreClient from "./ExploreClient";

// Live events come from the DB timeline, so this view must not be statically
// cached — read them fresh on each request and feed the 3D pyramid live pins.
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  let liveEvents: LiveEventMarker[] = [];
  try {
    liveEvents = await getLiveEvents();
  } catch (err) {
    // Never let a live-events read failure take down the explore page — the
    // pyramid still renders, just without live pins.
    console.error("[explore] failed to load live events:", err);
  }
  return <ExploreClient liveEvents={liveEvents} />;
}
