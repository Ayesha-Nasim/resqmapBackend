/**
 * Standards-like structure:
 * Risk = HazardBaseline × TriggerNow × (1 + EvidenceBoost)
 *
 * v1 HazardBaseline proxy = recencyScore (historical flood footprint proxy)
 * TriggerNow = rainScore (forecast)
 * EvidenceBoost = density + severity
 */
export function scoreFloodRisk({ rainScore, densityScore, severityScore, hazardScore }) {
  const hazard = clamp01(hazardScore);
  const trigger = clamp01(rainScore);

  const evidence = clamp01(0.65 * clamp01(densityScore) + 0.35 * clamp01(severityScore));

  // Base risk from hazard + trigger
  let risk = hazard * trigger;

  // Evidence can boost risk up to +70%
  risk = clamp01(risk * (1 + 0.7 * evidence));

  const level =
    risk >= 0.8 ? "extreme" :
    risk >= 0.6 ? "high" :
    risk >= 0.4 ? "medium" :
    "low";

  return {
    risk,
    level,
    drivers: {
      hazard,
      trigger,
      evidence,
      rain: trigger,
      density: clamp01(densityScore),
      severity: clamp01(severityScore),
    },
  };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}