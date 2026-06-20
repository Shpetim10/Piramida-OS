"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ScreenContainer } from "@/components/manager/ScreenContainer";

interface AssetResult {
  kind: "asset";
  asset: {
    id: string;
    name: string;
    assetTag: string;
    status: string;
    condition: string;
    qrCode: string | null;
    category: { name: string; trackingMode: string };
    currentLocation: { name: string } | null;
    notes: string | null;
  };
}

interface BatchResult {
  kind: "batch";
  batch: {
    id: string;
    name: string;
    totalQuantity: number;
    availableQuantity: number;
    reservedQuantity: number;
    damagedQuantity: number;
    category: { name: string };
  };
}

type QrResult = AssetResult | BatchResult;

interface Movement {
  id: string;
  status: string;
  scannedAt: string;
  notes: string | null;
  fromLocation: { name: string } | null;
  toLocation: { name: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#22C55E",
  SOFT_HOLD: "#C8F000",
  RESERVED: "#2A6FDB",
  PICKED: "#F59E0B",
  IN_TRANSIT: "#F59E0B",
  IN_USE: "#C0612A",
  RETURNED: "#22C55E",
  NEEDS_INSPECTION: "#F59E0B",
  MAINTENANCE: "#EF4444",
  MISSING: "#EF4444",
  RETIRED: "#7D8799",
};

type MovStatus = "PICKED" | "IN_TRANSIT" | "DELIVERED" | "RETURNED";

const MOV_ACTIONS: { label: string; status: MovStatus }[] = [
  { label: "Pick", status: "PICKED" },
  { label: "In Transit", status: "IN_TRANSIT" },
  { label: "Deliver", status: "DELIVERED" },
  { label: "Return", status: "RETURNED" },
];

export default function AssetQrPage({ params }: { params: Promise<{ assetQr: string }> }) {
  const { assetQr } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<QrResult | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [logMsg, setLogMsg] = useState<string | null>(null);

  const qrCode = decodeURIComponent(assetQr);

  useEffect(() => {
    fetch(`/api/inventory/qr/${encodeURIComponent(qrCode)}`)
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace(`/login?next=/manager/inventory/${encodeURIComponent(assetQr)}`);
          return Promise.reject("redirect");
        }
        if (!r.ok) return r.json().then((d) => Promise.reject(d.error ?? "QR code not found"));
        return r.json();
      })
      .then((data: QrResult) => {
        setResult(data);
        const idParam = data.kind === "asset" ? `assetId=${data.asset.id}` : `batchId=${data.batch.id}`;
        return fetch(`/api/inventory/movements?${idParam}`);
      })
      .then((r) => (r.ok ? r.json() : []))
      .then(setMovements)
      .catch((e) => { if (e !== "redirect") setError(String(e)); })
      .finally(() => setLoading(false));
  }, [qrCode, assetQr, router]);

  async function logAction(movStatus: MovStatus) {
    if (!result) return;
    setLogging(true);
    setLogMsg(null);
    const body =
      result.kind === "asset"
        ? { assetId: result.asset.id, status: movStatus }
        : { batchId: result.batch.id, status: movStatus, quantity: 1 };

    try {
      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setLogMsg(`Error: ${d.error ?? "Failed"}`);
      } else {
        const mov: Movement = await res.json();
        setMovements((m) => [mov, ...m]);
        setLogMsg(`Logged: ${movStatus}`);
      }
    } catch {
      setLogMsg("Network error");
    } finally {
      setLogging(false);
    }
  }

  return (
    <ScreenContainer>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 6 }}>
            QR SCAN
          </div>
          <div style={{ font: "700 22px/1.1 Inter, sans-serif", color: "#fff", wordBreak: "break-all" }}>{qrCode}</div>
        </div>

        {loading && (
          <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799" }}>Resolving QR code…</div>
        )}

        {error && (
          <div
            style={{
              border: "1px solid rgba(239,68,68,.3)",
              borderRadius: 16,
              background: "rgba(239,68,68,.08)",
              padding: 20,
              font: "500 14px Inter, sans-serif",
              color: "#EF4444",
            }}
          >
            {error}
          </div>
        )}

        {result && result.kind === "asset" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Asset card */}
            <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ font: "700 18px Inter, sans-serif", color: "#fff" }}>{result.asset.name}</div>
                  <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>
                    {result.asset.category.name} · {result.asset.assetTag}
                  </div>
                </div>
                <span
                  style={{
                    font: "700 9px 'JetBrains Mono', monospace",
                    letterSpacing: ".06em",
                    color: STATUS_COLOR[result.asset.status] ?? "#7D8799",
                    background: `${STATUS_COLOR[result.asset.status] ?? "#7D8799"}1f`,
                    padding: "6px 10px",
                    borderRadius: 8,
                    flex: "none",
                  }}
                >
                  {result.asset.status.replace("_", " ")}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Row label="Condition" value={result.asset.condition} />
                <Row label="Current location" value={result.asset.currentLocation?.name ?? "Unknown"} />
                {result.asset.notes && <Row label="Notes" value={result.asset.notes} />}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, background: "#151821", padding: 18 }}>
              <div style={{ font: "700 13px Inter, sans-serif", color: "#fff", marginBottom: 14 }}>Log movement</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                {MOV_ACTIONS.map((a) => (
                  <button
                    key={a.status}
                    onClick={() => logAction(a.status)}
                    disabled={logging}
                    style={{
                      padding: "11px 0",
                      borderRadius: 11,
                      border: "1px solid rgba(255,255,255,.1)",
                      background: "#0F1218",
                      color: "#E6E9EF",
                      font: "600 13px Inter, sans-serif",
                      cursor: logging ? "not-allowed" : "pointer",
                      opacity: logging ? 0.5 : 1,
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {logMsg && (
                <div
                  style={{
                    marginTop: 12,
                    font: "500 12px Inter, sans-serif",
                    color: logMsg.startsWith("Error") ? "#EF4444" : "#22C55E",
                  }}
                >
                  {logMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {result && result.kind === "batch" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Batch card */}
            <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 22 }}>
              <div style={{ font: "700 18px Inter, sans-serif", color: "#fff", marginBottom: 6 }}>{result.batch.name}</div>
              <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginBottom: 16 }}>
                {result.batch.category.name} · Bulk batch
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                <QuantCard label="Total" value={result.batch.totalQuantity} color="#fff" />
                <QuantCard label="Available" value={result.batch.availableQuantity} color="#22C55E" />
                <QuantCard label="Reserved" value={result.batch.reservedQuantity} color="#2A6FDB" />
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, background: "#151821", padding: 18 }}>
              <div style={{ font: "700 13px Inter, sans-serif", color: "#fff", marginBottom: 14 }}>Log movement (qty 1)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                {MOV_ACTIONS.map((a) => (
                  <button
                    key={a.status}
                    onClick={() => logAction(a.status)}
                    disabled={logging}
                    style={{
                      padding: "11px 0",
                      borderRadius: 11,
                      border: "1px solid rgba(255,255,255,.1)",
                      background: "#0F1218",
                      color: "#E6E9EF",
                      font: "600 13px Inter, sans-serif",
                      cursor: logging ? "not-allowed" : "pointer",
                      opacity: logging ? 0.5 : 1,
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {logMsg && (
                <div
                  style={{
                    marginTop: 12,
                    font: "500 12px Inter, sans-serif",
                    color: logMsg.startsWith("Error") ? "#EF4444" : "#22C55E",
                  }}
                >
                  {logMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Movement history */}
        {movements.length > 0 && (
          <div style={{ marginTop: 20, border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, background: "#151821", padding: 18 }}>
            <div style={{ font: "700 13px Inter, sans-serif", color: "#fff", marginBottom: 14 }}>Movement history</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {movements.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                  <span
                    style={{
                      font: "700 9px 'JetBrains Mono', monospace",
                      letterSpacing: ".06em",
                      color: "#7D8799",
                      background: "rgba(255,255,255,.06)",
                      padding: "4px 8px",
                      borderRadius: 6,
                      flex: "none",
                    }}
                  >
                    {m.status}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>
                      {m.fromLocation ? `${m.fromLocation.name} → ` : ""}
                      {m.toLocation?.name ?? "—"}
                    </div>
                    {m.notes && <div style={{ font: "400 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{m.notes}</div>}
                  </div>
                  <span style={{ font: "400 11px 'JetBrains Mono', monospace", color: "#39414F", flex: "none" }}>
                    {new Date(m.scannedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".06em", width: 120, flex: "none" }}>
        {label.toUpperCase()}
      </span>
      <span style={{ font: "500 12px Inter, sans-serif", color: "#E6E9EF" }}>{value}</span>
    </div>
  );
}

function QuantCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0", background: "#0F1218", borderRadius: 12 }}>
      <div style={{ font: "800 24px/1 Inter, sans-serif", color }}>{value}</div>
      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 5, letterSpacing: ".06em" }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}
