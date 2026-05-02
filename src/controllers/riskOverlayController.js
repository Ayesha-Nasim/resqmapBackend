import { buildFloodRiskOverlay } from "../services/riskOverlay/riskOverlayService.js";

export const getRiskOverlay = async (req, res) => {
  try {
    const type = (req.query.type || "flood").toString().toLowerCase();
    if (type !== "flood") {
      return res.status(400).json({ error: "Only type=flood is supported for now." });
    }

    const window = (req.query.window || "24h").toString().toLowerCase(); // 6h | 24h
    if (!["6h", "24h"].includes(window)) {
      return res.status(400).json({ error: "window must be 6h or 24h" });
    }

    const bboxStr = (req.query.bbox || "").toString().trim();
    const bbox = bboxStr ? bboxStr.split(",").map(Number) : null;

    if (bbox && (bbox.length !== 4 || bbox.some((n) => Number.isNaN(n)))) {
      return res.status(400).json({
        error: "Invalid bbox. Use bbox=minLng,minLat,maxLng,maxLat",
      });
    }

    const geojson = await buildFloodRiskOverlay({ window, bbox });
    return res.json(geojson);
  } catch (err) {
    console.error("getRiskOverlay error:", err);
    return res.status(500).json({ error: "Failed to build risk overlay" });
  }
};