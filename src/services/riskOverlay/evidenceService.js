import { IncidentModel } from "../../models/incidentModel.js";
import { coordToCellIndex } from "./gridService.js";

/**
 * Evidence is built ONLY from real incidents (no predictions).
 * Returns evidence keyed by cell INDEX (0..totalCells-1)
 */
export async function buildFloodEvidence(grid) {
  const incidents = await IncidentModel.getRecentIncidents(500);

  const total = grid.totalCells;

  // ✅ allocate arrays only for totalCells (and totalCells is already limited)
  const counts = new Array(total).fill(0);
  const sevSum = new Array(total).fill(0);
  const recencySum = new Array(total).fill(0);

  const now = Date.now();

  for (const inc of incidents) {
    const type = (inc.type || "").toString().toLowerCase();
    const customType = (inc.customType || "").toString().toLowerCase();

    // Flood-only strict
    const isFlood = type === "flood" || customType === "flood";
    if (!isFlood) continue;

    const lat = Number(inc.latitude);
    const lng = Number(inc.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    const idx = coordToCellIndex({ lng, lat, grid });
    if (idx == null) continue;

    counts[idx] += 1;

    const sev = normalizeSeverity(inc.severity);
    sevSum[idx] += sev;

    const createdAtMs = toMillis(inc.createdAt) ?? now;
    const daysAgo = Math.max(0, (now - createdAtMs) / (1000 * 60 * 60 * 24));
    const recency = Math.exp(-daysAgo / 30); // last ~30 days matters most
    recencySum[idx] += recency;
  }

  const maxCount = Math.max(1, ...counts);
  const maxRecency = Math.max(1e-9, ...recencySum);

  // Return evidence as index->scores object
  const evidence = {};
  for (let i = 0; i < total; i++) {
    const c = counts[i];
    const avgSev = c ? sevSum[i] / c : 0;

    evidence[i] = {
      densityScore: c / maxCount,
      severityScore: clamp01(avgSev),
      recencyScore: clamp01(recencySum[i] / maxRecency),
      count: c,
    };
  }

  return evidence;
}

function normalizeSeverity(sev) {
  if (sev == null) return 0;
  if (typeof sev === "number") return clamp01(sev);

  const s = String(sev).toLowerCase();
  if (s.includes("critical")) return 1.0;
  if (s.includes("high")) return 0.8;
  if (s.includes("medium")) return 0.5;
  if (s.includes("low")) return 0.2;
  if (s.includes("pending")) return 0.0;

  const n = Number(s);
  if (!Number.isNaN(n)) return clamp01(n / 4);

  return 0.0;
}

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts === "number") return ts;
  if (ts?.toDate) return ts.toDate().getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}