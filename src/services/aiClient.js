import axios from "axios";

const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";

export async function classifySeverityAI(payload) {
  // payload: { type, description, weather, imageUrl? }
  const res = await axios.post(`${AI_URL}/classify`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return res.data; // {severity, confidence, score, signals}
}
