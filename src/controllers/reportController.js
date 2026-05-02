import { db } from "../config/firebase.js";
import { IncidentModel } from "../models/incidentModel.js";

const incidentsCollection = db.collection("incidents");

function toDateSafe(val) {
  if (!val) return null;

  if (val instanceof Date) return val;

  if (typeof val === "object") {
    if (typeof val.toDate === "function") return val.toDate();
    if (typeof val._seconds === "number") return new Date(val._seconds * 1000);
    if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
  }

  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeText(val, fallback = "Unknown") {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  return s ? s : fallback;
}

function normalizeSeverity(severity) {
  return normalizeText(severity, "unknown").toLowerCase();
}

function normalizeType(incident) {
  const type = normalizeText(incident.type, "Unknown");
  if (type.toLowerCase() === "other" && incident.customType) {
    return normalizeText(incident.customType, "Other");
  }
  return type;
}

function normalizeArea(fullAddress) {
  if (!fullAddress) return "Unknown";
  const parts = String(fullAddress)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || "Unknown";
}

function getLastNDaysLabels(days = 7) {
  const labels = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }

  return labels;
}

async function getCountByStatus(status) {
  const snap = await incidentsCollection.where("status", "==", status).count().get();
  return snap.data().count || 0;
}

export const getAdminReportsSummary = async (req, res) => {
  try {
    // Fast counts using aggregation queries
    const [
      totalSnap,
      pendingReview,
      verified,
      triaged,
      assigned,
      inProgress,
      resolved,
      rejected,
    ] = await Promise.all([
      incidentsCollection.count().get(),
      getCountByStatus("pending_review"),
      getCountByStatus("verified"),
      getCountByStatus("triaged"),
      getCountByStatus("assigned"),
      getCountByStatus("in_progress"),
      getCountByStatus("resolved"),
      getCountByStatus("rejected"),
    ]);

    const summaryCards = {
      total: totalSnap.data().count || 0,
      pending_review: pendingReview,
      verified,
      triaged,
      assigned,
      in_progress: inProgress,
      resolved,
      rejected,
    };

    // Only recent docs for charts/tables
    const incidents = await IncidentModel.getRecentIncidents(250);

    const severityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      pending: 0,
      unknown: 0,
    };

    const typeMap = {};
    const areaMap = {};
    const responderMap = {};
    const trendMap = {};

    const trendLabels = getLastNDaysLabels(7);
    for (const label of trendLabels) trendMap[label] = 0;

    for (const incident of incidents) {
      const severity = normalizeSeverity(incident.severity);
      const type = normalizeType(incident);
      const area = normalizeArea(incident.fullAddress);

      if (severityCounts[severity] !== undefined) {
        severityCounts[severity] += 1;
      } else {
        severityCounts.unknown += 1;
      }

      typeMap[type] = (typeMap[type] || 0) + 1;
      areaMap[area] = (areaMap[area] || 0) + 1;

      if (incident.assignedTo) {
        if (!responderMap[incident.assignedTo]) {
          responderMap[incident.assignedTo] = {
            responderId: incident.assignedTo,
            assignedCount: 0,
            inProgressCount: 0,
            resolvedCount: 0,
          };
        }

        responderMap[incident.assignedTo].assignedCount += 1;

        const st = String(incident.status || "").toLowerCase();
        if (st === "in_progress") responderMap[incident.assignedTo].inProgressCount += 1;
        if (st === "resolved") responderMap[incident.assignedTo].resolvedCount += 1;
      }

      const createdAt = toDateSafe(incident.createdAt);
      if (createdAt) {
        const dayKey = new Date(createdAt);
        dayKey.setHours(0, 0, 0, 0);
        const iso = dayKey.toISOString().slice(0, 10);

        if (trendMap[iso] !== undefined) {
          trendMap[iso] += 1;
        }
      }
    }

    const types = Object.entries(typeMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const topAreas = Object.entries(areaMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const responderWorkload = Object.values(responderMap)
      .sort((a, b) => b.assignedCount - a.assignedCount)
      .slice(0, 8);

    const incidentTrend7Days = trendLabels.map((label) => ({
      label,
      count: trendMap[label] || 0,
    }));

    const recentCritical = incidents
      .filter((i) => normalizeSeverity(i.severity) === "high")
      .sort((a, b) => {
        const da = toDateSafe(a.createdAt)?.getTime() || 0;
        const db = toDateSafe(b.createdAt)?.getTime() || 0;
        return db - da;
      })
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        type: normalizeType(i),
        status: normalizeText(i.status, "unknown"),
        severity: normalizeText(i.severity, "unknown"),
        fullAddress: i.fullAddress || "Unknown",
        createdAt: toDateSafe(i.createdAt),
      }));

    return res.json({
      success: true,
      summaryCards,
      severityCounts,
      types,
      topAreas,
      responderWorkload,
      incidentTrend7Days,
      recentCritical,
      generatedAt: new Date(),
      note: "Counts are full-collection; charts are based on recent records for faster loading",
    });
  } catch (err) {
    console.error("getAdminReportsSummary error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate admin reports summary",
    });
  }
};