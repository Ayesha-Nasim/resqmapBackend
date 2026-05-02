import { buildGrid, getCellRing, cellIdFromIndex } from "./gridService.js";
import { getForecastRainSummary } from "./weatherForecastService.js";
import { buildFloodEvidence } from "./evidenceService.js";
import { scoreFloodRisk } from "./scoringService.js";

function parseDefaultBboxFromEnv() {
  const raw = (process.env.RISK_DEFAULT_BBOX || "").trim();
  if (!raw) return null;

  const arr = raw.split(",").map(Number);
  if (arr.length !== 4 || arr.some((n) => Number.isNaN(n))) return null;
  return arr;
}

export async function buildFloodRiskOverlay({ window = "24h", bbox = null }) {
  const DEFAULT_BBOX = parseDefaultBboxFromEnv() || [73.0, 33.55, 73.2, 33.75];
  const useBbox = bbox || DEFAULT_BBOX;

  // safer default for large bboxes
  const cellSizeDeg = Number(process.env.RISK_CELL_SIZE_DEG || "0.02");

  // IMPORTANT: pass maxCells so buildGrid can refuse BEFORE allocating
  const MAX_CELLS = Number(process.env.RISK_MAX_CELLS || "2500");
  const grid = buildGrid(useBbox, cellSizeDeg, { maxCells: MAX_CELLS });

  // ✅ If bbox too large, return a clean empty overlay (NO crash, NO throw)
  if (grid.limited) {
    return {
      type: "FeatureCollection",
      meta: {
        type: "flood",
        window,
        bbox: useBbox,
        grid: {
          cellSizeDeg,
          rows: grid.rows,
          cols: grid.cols,
          cells: grid.totalCells,
          maxCells: grid.maxCells,
          limited: true,
        },
        error: `Zoom in to view overlay (requested ${grid.totalCells} cells > limit ${grid.maxCells}).`,
      },
      features: [],
    };
  }

  // Forecast trigger
  const forecast = await getForecastRainSummary(useBbox, window);

  // Evidence from DB incidents (now keyed by index)
  const evidenceByIndex = await buildFloodEvidence(grid);

  // ✅ Build features lazily by looping rows/cols (no grid.cells needed)
  const features = [];
  let idx = 0;

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const ev = evidenceByIndex[idx] || {
        densityScore: 0,
        severityScore: 0,
        recencyScore: 0,
        count: 0,
      };

      const scored = scoreFloodRisk({
        rainScore: forecast.rainScore,
        densityScore: ev.densityScore,
        severityScore: ev.severityScore,
        hazardScore: ev.recencyScore,
      });

      features.push({
        type: "Feature",
        properties: {
          id: cellIdFromIndex(idx),
          risk: scored.risk,
          level: scored.level,
          drivers: scored.drivers,
          incidentCount: ev.count,
        },
        geometry: {
          type: "Polygon",
          coordinates: [getCellRing({ row: r, col: c, grid })],
        },
      });

      idx++;
    }
  }

  return {
    type: "FeatureCollection",
    meta: {
      type: "flood",
      window,
      bbox: useBbox,
      grid: {
        cellSizeDeg,
        rows: grid.rows,
        cols: grid.cols,
        cells: grid.totalCells,
        maxCells: MAX_CELLS,
        limited: false,
      },
      forecast,
      note:
        "v1 overlay = forecast rain trigger + historical incident evidence. Not stored as incidents.",
    },
    features,
  };
}