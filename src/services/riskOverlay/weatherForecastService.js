import axios from "axios";

/**
 * Forecast rainfall trigger using Open-Meteo (no key required).
 * We sample bbox center for v1 (good tradeoff).
 */
export async function getForecastRainSummary(bbox, window = "24h") {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;

  const url = "https://api.open-meteo.com/v1/forecast";

  const res = await axios.get(url, {
    params: {
      latitude,
      longitude,
      hourly: "precipitation",
      forecast_days: 2,
      timezone: "auto",
    },
    timeout: 15000,
  });

  const hourly = res?.data?.hourly?.precipitation || [];
  const hours = window === "6h" ? 6 : 24;
  const next = hourly.slice(0, hours).map((x) => Number(x) || 0);

  const rainSumMm = next.reduce((a, b) => a + b, 0);
  const rainPeakMmPerHr = next.reduce((m, v) => Math.max(m, v), 0);

  // Defensible thresholding:
  // 50mm/24h considered extreme trigger for urban flooding (configurable)
  const rainScore = clamp01(rainSumMm / 50);

  return {
    provider: "open-meteo",
    window,
    latitude,
    longitude,
    rainSumMm,
    rainPeakMmPerHr,
    rainScore,
  };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}