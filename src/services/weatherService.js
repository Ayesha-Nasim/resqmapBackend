import axios from "axios";

const OWM_KEY = process.env.OPENWEATHER_API_KEY;

export async function getWeatherForCoords(lat, lon) {
  if (!OWM_KEY) return null;

  // OpenWeather "Current weather"
  const url = "https://api.openweathermap.org/data/2.5/weather";
  const res = await axios.get(url, {
    params: { lat, lon, appid: OWM_KEY, units: "metric" },
    timeout: 10000,
  });

  const d = res.data || {};

  return {
    temp: d?.main?.temp ?? null,
    humidity: d?.main?.humidity ?? null,
    windSpeed: d?.wind?.speed ?? null,
    // rain can be missing if no rain
    rain1h: d?.rain?.["1h"] ?? 0,
    clouds: d?.clouds?.all ?? null,
    condition: d?.weather?.[0]?.main ?? null,
  };
}
