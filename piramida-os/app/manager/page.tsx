import { getDashboardData } from "@/lib/services/dashboard";
import { getSetting } from "@/lib/services/settings";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

type TwinRoom = { slug: string; name: string; x: number; y: number; w: number; h: number; color: string };

const FALLBACK_ROOMS: TwinRoom[] = [
  { slug: "main-corridor", name: "Main Corridor", x: 236, y: 150, w: 128, h: 48, color: "#7A4BD6" },
  { slug: "green-room", name: "Green Room", x: 182, y: 218, w: 112, h: 58, color: "#22C55E" },
  { slug: "yellow-room", name: "Yellow Room", x: 306, y: 218, w: 112, h: 58, color: "#C9A227" },
  { slug: "blue-room", name: "Blue Room", x: 128, y: 300, w: 158, h: 54, color: "#2A6FDB" },
  { slug: "orange-room", name: "Orange Room", x: 314, y: 300, w: 158, h: 54, color: "#C0612A" },
  { slug: "entrance", name: "Entrance", x: 262, y: 360, w: 76, h: 24, color: "#AEB5C2" },
];

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: selectedEventId } = await searchParams;
  const [data, rooms] = await Promise.all([
    getDashboardData(selectedEventId).catch(() => null),
    getSetting<TwinRoom[]>("twin.room_positions").catch(() => null),
  ]);

  if (!data) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          font: "500 14px Inter, sans-serif",
          color: "#7D8799",
        }}
      >
        Loading dashboard — run <code style={{ marginLeft: 6 }}>npm run db:seed</code> to populate demo data.
      </div>
    );
  }

  return <DashboardClient data={data} rooms={rooms ?? FALLBACK_ROOMS} selectedEventId={selectedEventId} />;
}
