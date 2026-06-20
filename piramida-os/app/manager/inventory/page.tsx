"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { QrScannerModal } from "@/components/manager/QrScannerModal";
import { LIME } from "@/lib/manager/data";

const A = LIME;

interface Category {
  id: string;
  name: string;
  trackingMode: string;
}

interface Asset {
  id: string;
  name: string;
  status: string;
  categoryId: string;
}

interface Batch {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  categoryId: string;
}

interface InventoryData {
  categories: Category[];
  assets: Asset[];
  batches: Batch[];
}

interface CatStat {
  cat: string;
  items: string;
  health: number;
  status: string;
  sc: string;
  note: string;
}

interface SummaryCard {
  label: string;
  value: string;
  unit: string;
  sub: string;
  tone: string;
}

function computeStats(data: InventoryData): { summary: SummaryCard[]; cats: CatStat[] } {
  const { categories, assets, batches } = data;

  const totalSerialized = assets.length;
  const availableSerialized = assets.filter((a) => a.status === "AVAILABLE").length;
  const reservedSerialized = assets.filter(
    (a) => a.status === "RESERVED" || a.status === "SOFT_HOLD",
  ).length;

  const totalBatchItems = batches.reduce((s, b) => s + b.totalQuantity, 0);
  const availableBatchItems = batches.reduce((s, b) => s + (b.availableQuantity ?? 0), 0);
  const reservedBatchItems = totalBatchItems - availableBatchItems;

  const totalAll = totalSerialized + totalBatchItems;
  const reservedAll = reservedSerialized + reservedBatchItems;
  const availableAll = availableSerialized + availableBatchItems;
  const healthPct = totalAll > 0 ? Math.round((availableAll / totalAll) * 100) : 100;

  const summary: SummaryCard[] = [
    { label: "Overall Health", value: String(healthPct), unit: "%", sub: `across ${categories.length} categories`, tone: healthPct >= 80 ? "#22C55E" : healthPct >= 60 ? "#F59E0B" : "#EF4444" },
    { label: "Total Assets", value: String(totalAll), unit: "", sub: `${totalSerialized} serialized · ${batches.length} batches`, tone: "#fff" },
    { label: "Reserved", value: String(reservedAll), unit: `/${totalAll}`, sub: `${totalAll > 0 ? Math.round((reservedAll / totalAll) * 100) : 0}% committed`, tone: A },
    { label: "Available", value: String(availableAll), unit: "", sub: "ready to allocate", tone: "#22C55E" },
  ];

  const cats: CatStat[] = categories.map((c) => {
    const catAssets = assets.filter((a) => a.categoryId === c.id);
    const catBatches = batches.filter((b) => b.categoryId === c.id);

    const catTotal = catAssets.length + catBatches.reduce((s, b) => s + b.totalQuantity, 0);
    const catAvail =
      catAssets.filter((a) => a.status === "AVAILABLE").length +
      catBatches.reduce((s, b) => s + (b.availableQuantity ?? 0), 0);

    const health = catTotal > 0 ? Math.round((catAvail / catTotal) * 100) : 100;
    const statusLabel = health >= 80 ? "Healthy" : health >= 50 ? "Watch" : "Critical";
    const sc = health >= 80 ? "#22C55E" : health >= 50 ? "#F59E0B" : "#EF4444";
    const itemStr =
      catAssets.length > 0 && catBatches.length > 0
        ? `${catAssets.length} serialized · ${catBatches.length} batch${catBatches.length !== 1 ? "es" : ""}`
        : catAssets.length > 0
          ? `${catAssets.length} serialized`
          : `${catBatches.length} bulk batch${catBatches.length !== 1 ? "es" : ""}`;

    return {
      cat: c.name,
      items: itemStr || "No items",
      health,
      status: statusLabel,
      sc,
      note: `${catAvail} of ${catTotal} available`,
    };
  });

  return { summary, cats };
}

export default function ManagerInventoryPage() {
  const router = useRouter();
  const [data, setData] = useState<{ summary: SummaryCard[]; cats: CatStat[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((raw: InventoryData) => setData(computeStats(raw)))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  function handleDetected(code: string) {
    setScannerOpen(false);
    router.push(`/manager/inventory/${encodeURIComponent(code)}`);
  }

  const summary = data?.summary ?? [];
  const cats = data?.cats ?? [];

  return (
    <ScreenContainer>
      {/* Scan button */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setScannerOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "13px 22px",
            borderRadius: 14,
            border: "1px solid rgba(200,240,0,.3)",
            background: "rgba(200,240,0,.07)",
            color: "#C8F000",
            font: "700 14px Inter, sans-serif",
            cursor: "pointer",
            width: "100%",
            justifyContent: "center",
          }}
        >
          <CameraIcon />
          Scan Asset QR Code
        </button>
      </div>

      {scannerOpen && (
        <QrScannerModal onDetected={handleDetected} onClose={() => setScannerOpen(false)} />
      )}

      {loading && (
        <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", marginBottom: 20 }}>Loading inventory…</div>
      )}

      {/* Summary */}
      {summary.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
          {summary.map((s) => (
            <div
              key={s.label}
              style={{
                border: `1px solid ${s.tone === A ? "rgba(200,240,0,.2)" : "rgba(255,255,255,.07)"}`,
                borderRadius: 16,
                background: "#151821",
                padding: 18,
              }}
            >
              <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 12 }}>
                {s.label.toUpperCase()}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ font: "800 30px/1 Inter, sans-serif", letterSpacing: "-.03em", color: s.tone }}>{s.value}</span>
                {s.unit && <span style={{ font: "600 12px Inter, sans-serif", color: "#7D8799" }}>{s.unit}</span>}
              </div>
              <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 6 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Category header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Category health</div>
        <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>
          {data ? "Live from database." : "Operational awareness — not stock management."}
        </span>
      </div>

      {/* Category cards */}
      {cats.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {cats.map((c) => (
            <div key={c.cat} style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, background: "#151821", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{c.cat}</div>
                  <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>{c.items}</div>
                </div>
                <span
                  style={{
                    font: "700 9px 'JetBrains Mono', monospace",
                    letterSpacing: ".06em",
                    color: c.sc,
                    background: `${c.sc}1f`,
                    padding: "5px 9px",
                    borderRadius: 7,
                    flex: "none",
                  }}
                >
                  {c.status.toUpperCase()}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 4, background: "#0F1218", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.health}%`, borderRadius: 4, background: c.sc }} />
                </div>
                <span style={{ font: "800 15px 'JetBrains Mono', monospace", color: c.sc }}>{c.health}</span>
              </div>
              <div style={{ font: "500 12px/1.45 Inter, sans-serif", color: "#AEB5C2" }}>{c.note}</div>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div
            style={{
              border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 16,
              background: "#151821",
              padding: 32,
              textAlign: "center",
              color: "#7D8799",
              font: "500 13px Inter, sans-serif",
            }}
          >
            No inventory categories found. Run the seed script to populate demo data.
          </div>
        )
      )}
    </ScreenContainer>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
