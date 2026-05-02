import axios from "axios";
import { IncidentModel } from "../models/incidentModel.js";
import { bucket } from "../config/firebase.js";

/**
 * ================================
 * UC-02: Submit Incident (Citizen)
 * ================================
 */
export const submitIncident = async (req, res) => {
  console.log("📥 Incoming Incident Submission");

  try {
    const {
      userId,
      type,
      customType,
      description,
      latitude,
      longitude,
      fullAddress,

      // ✅ NEW (from updated submit-incident.tsx)
      subType,
      peopleAtRisk,
    } = req.body;

    console.log("🔹 Body:", {
      userId,
      type,
      customType,
      descriptionLength: description?.length,
      latitude,
      longitude,
      fullAddress,
      subType,
      peopleAtRisk,
    });

    // ---------------- VALIDATION ----------------
    if (!userId || !type || !description || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (type === "Other" && !customType) {
      return res.status(400).json({ error: "Custom type required." });
    }

    // DB type will be actual final type (like before)
    const finalType = type === "Other" ? customType : type;

    // ---------------- IMAGE UPLOAD ----------------
    // ✅ still upload/store image, but DO NOT use it for severity
    let imageUrl = null;

    if (req.file) {
      try {
        const safeName = req.file.originalname || `image_${Date.now()}.jpg`;
        const fileName = `incidents/${Date.now()}_${safeName}`;
        const fileRef = bucket.file(fileName);

        await fileRef.save(req.file.buffer, {
          metadata: { contentType: req.file.mimetype || "image/jpeg" },
          public: true,
          validation: false,
        });

        imageUrl = fileRef.publicUrl();
      } catch (err) {
        console.error("❌ Image upload failed:", err);
        return res.status(500).json({ error: "Image upload failed" });
      }
    }

    // ---------------- WEATHER FETCH (OpenWeather) ----------------
    // Keep it (optional), but format keys compatible with ai-service schema
    let weather = null;

    try {
      const OWM_KEY = process.env.OPENWEATHER_API_KEY;
      if (OWM_KEY) {
        const lat = Number(latitude);
        const lon = Number(longitude);

        const wRes = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
          params: { lat, lon, appid: OWM_KEY, units: "metric" },
          timeout: 8000,
        });

        const data = wRes.data || {};
        weather = {
          temp: data?.main?.temp ?? null,
          humidity: data?.main?.humidity ?? null,
          windSpeed: data?.wind?.speed ?? null,
          condition: data?.weather?.[0]?.main ?? null,
        };
      } else {
        console.log("⚠️ OPENWEATHER_API_KEY missing → weather skipped");
      }
    } catch (e) {
      console.log("⚠️ Weather fetch failed → continue without weather");
      weather = null;
    }

    // ---------------- AI SEVERITY (ML-first, fallback inside ai-service) ----------------
    // ✅ Call /predict
    // ✅ DO NOT send imageUrl/imageBase64
    let severity = "pending";
    let severitySource = null; // "ml" | "fallback"
    let severityMeta = null;   // debug info
    let mlConfidence = null;

    try {
      const AI_BASE = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";

      const aiRes = await axios.post(
        `${AI_BASE}/predict`,
        {
          type: finalType,              // e.g. Fire/Flood/Road Accident/Other(custom)
          description,                  // text for model
          latitude: Number(latitude),
          longitude: Number(longitude),

          // ✅ New fields that help fallback (and you may use later for ML)
          subType: finalType === "Fire" ? (subType || null) : null,
          peopleAtRisk:
            typeof peopleAtRisk === "boolean"
              ? peopleAtRisk
              : peopleAtRisk === "true"
              ? true
              : peopleAtRisk === "false"
              ? false
              : null,

          // optional
          weather: weather || undefined,

          // you can attach meta if you want
          meta: {
            fullAddress: fullAddress || null,
            originalType: type,
          },
        },
        { timeout: 12000 }
      );

      // ai-service returns: { label, confidence, source, meta }
      let label = aiRes?.data?.label || "pending";
      const conf = aiRes?.data?.confidence;

      // ✅ normalize label to your system values
      if (String(label).toLowerCase() === "moderate") label = "medium";
      label = String(label).toLowerCase();

      // only accept known values
      const allowed = ["low", "medium", "high", "pending"];
      severity = allowed.includes(label) ? label : "pending";

      severitySource = aiRes?.data?.source || null;
      severityMeta = aiRes?.data?.meta || null;
      mlConfidence = typeof conf === "number" ? conf : null;
    } catch (e) {
      console.log("⚠️ AI unavailable → severity pending");
      severity = "pending";
      severitySource = null;
      severityMeta = null;
      mlConfidence = null;
    }

    // ---------------- SAVE INCIDENT ----------------
    const incidentData = {
      userId,

      // Keep DB storing final type (same behavior you had)
      type: finalType,

      // store customType only if original type was Other
      customType: type === "Other" ? customType : null,

      description,
      latitude: Number(latitude),
      longitude: Number(longitude),
      fullAddress: fullAddress || null,

      // ✅ NEW: store Fire fields (safe to store for all)
      subType: finalType === "Fire" ? (subType || null) : null,
      peopleAtRisk,

      imageUrl,

      // severity + metadata
      severity,
      severitySource,
      severityMeta,
      mlConfidence,
    };

    const saved = await IncidentModel.createIncident(incidentData);

    return res.status(201).json({
      success: true,
      message: "Incident submitted successfully",
      incident: saved,
    });
  } catch (err) {
    console.error("🔥 Submit Incident Error:", err);
    return res.status(500).json({ error: "Failed to submit incident" });
  }
};

/**
 * ==========================================
 * UC-03: View Pending Incidents (Admin)
 * ==========================================
 */
export const getPendingIncidents = async (req, res) => {
  try {
    const incidents = await IncidentModel.getIncidentsByStatus("pending_review");

    return res.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (err) {
    console.error("❌ Fetch pending incidents failed:", err);
    return res.status(500).json({ error: "Failed to fetch incidents" });
  }
};

/**
 * ==========================================
 * UC-03: Review Incident (Verify / Reject)
 * ==========================================
 */
export const reviewIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, severity } = req.body;
    const adminId = req.user?.id;

    // ✅ validate decision
    if (!["verified", "rejected"].includes(decision)) {
      return res.status(400).json({
        error: "Decision must be 'verified' or 'rejected'",
      });
    }

    // ✅ validate severity if admin is overriding it
    if (severity) {
      const allowed = ["low", "medium", "high", "pending"];
      if (!allowed.includes(String(severity).toLowerCase())) {
        return res.status(400).json({
          error: "Severity must be one of: low, medium, high, pending",
        });
      }
    }

    // ✅ updates
    const updates = {
      status: decision,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    };

    // Keep your old field names too if your DB/UI already depends on them
    // (optional but safe)
    updates.verifiedBy = adminId;
    updates.verifiedAt = new Date();

    // Admin may override severity
    if (severity) updates.severity = String(severity).toLowerCase();

    const updated = await IncidentModel.updateIncident(id, updates);

    if (!updated) {
      return res.status(404).json({ error: "Incident not found" });
    }

    return res.json({
      success: true,
      message: `Incident ${decision} successfully`,
      incident: updated,
      decision,
    });
  } catch (err) {
    console.error("❌ Review Incident Error:", err);
    return res.status(500).json({ error: "Failed to review incident" });
  }
};
/**
 * =====================================
 * UC-04: Assign Incident (Admin -> Responder)
 * PATCH /api/incidents/:id/assign
 * body: { responderId }
 * =====================================
 */
export const assignIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { responderId } = req.body;

    if (!responderId) {
      return res.status(400).json({ error: "responderId is required" });
    }

    const incident = await IncidentModel.getIncidentById(id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const updated = await IncidentModel.updateIncident(id, {
      assignedTo: responderId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    });

    return res.json({
      success: true,
      message: "Incident assigned successfully",
      incident: updated,
    });
  } catch (err) {
    console.error("assignIncident error:", err);
    return res.status(500).json({ error: "Failed to assign incident" });
  }
};

/**
 * =====================================
 * UC-05: Responder gets assigned incidents
 * GET /api/incidents/assigned/:responderId
 * =====================================
 */
export const getAssignedIncidents = async (req, res) => {
  try {
    const { responderId } = req.params;

    const incidents = await IncidentModel.getIncidentsAssignedTo(responderId);

    return res.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (err) {
    console.error("getAssignedIncidents error:", err);
    return res.status(500).json({ error: "Failed to fetch assigned incidents" });
  }
};

/**
 * =====================================
 * UC-06: Responder updates incident status
 * PATCH /api/incidents/:id/progress
 * body: { status: "in_progress" | "resolved" }
 * =====================================
 */
export const updateIncidentProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["in_progress", "resolved"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "status must be 'in_progress' or 'resolved'",
      });
    }

    const incident = await IncidentModel.getIncidentById(id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const updated = await IncidentModel.updateIncident(id, {
      status,
      resolvedAt: status === "resolved" ? new Date().toISOString() : null,
    });

    return res.json({
      success: true,
      message: "Incident status updated",
      incident: updated,
    });
  } catch (err) {
    console.error("updateIncidentProgress error:", err);
    return res.status(500).json({ error: "Failed to update incident" });
  }
};
export const getVerifiedIncidents = async (req, res) => {
  try {
    const incidents = await IncidentModel.getIncidentsByStatus("verified");

    return res.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (err) {
    console.error("❌ Fetch verified incidents failed:", err);
    return res.status(500).json({ error: "Failed to fetch verified incidents" });
  }
};
/**
 * ==========================================
 * UC: Live Map Incidents (Citizen/Responder)
 * GET /api/incidents/map?status=verified,assigned&severity=high,medium
 * ==========================================
 */
export const getMapIncidents = async (req, res) => {
  try {
    const { status, severity, type, limit } = req.query;

    const limitCount = Number(limit) || 200;

    // ✅ Fetch recent incidents only (no where clauses) -> avoids Firestore composite index
    let incidents = await IncidentModel.getRecentIncidents(limitCount);

    // ---------- Optional filtering in Node ----------
    const statusArr = status ? String(status).split(",").map(s => s.trim()) : null;
    const severityArr = severity ? String(severity).split(",").map(s => s.trim()) : null;
    const typeArr = type ? String(type).split(",").map(s => s.trim()) : null;

    if (statusArr) incidents = incidents.filter(i => statusArr.includes(i.status));
    if (severityArr) incidents = incidents.filter(i => severityArr.includes(i.severity));
    if (typeArr) incidents = incidents.filter(i => typeArr.includes(i.type));

    return res.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (err) {
    console.error("❌ getMapIncidents error:", err);
    return res.status(500).json({ error: "Failed to fetch map incidents" });
  }
};
/**
 * =====================================
 * Admin: View all assigned/progress incidents
 * GET /api/incidents/assigned
 * =====================================
 */
export const getAllAssignedIncidents = async (req, res) => {
  try {
    // optionally enforce admin only
    // if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const incidents = await IncidentModel.getAllAssignedIncidents();

    return res.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (err) {
    console.error("getAllAssignedIncidents error:", err);
    return res.status(500).json({ error: "Failed to fetch assigned incidents" });
  }
};
/**
 * =====================================
 * UC-NEW: Responder picks incident (Option A: TRIAGE)
 * PATCH /api/incidents/:id/pick
 * - Allows responder to pick:
 *    ✅ verified  -> status becomes "assigned"
 *    ✅ pending_review -> status becomes "triaged" (provisional)
 * - Enforces: max 2 active incidents (triaged/assigned/in_progress)
 * =====================================
 */
export const responderPickIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const responderId = req.user?.id;

    if (!responderId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 1️⃣ Check if incident exists
    const incident = await IncidentModel.getIncidentById(id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    // 2️⃣ Allow picking verified OR pending_review (unverified)
    const allowedPickStatuses = ["verified", "pending_review"];
    if (!allowedPickStatuses.includes(incident.status)) {
      return res.status(400).json({
        error: "Only verified or pending incidents can be picked",
      });
    }

    // 3️⃣ Check if already assigned
    if (incident.assignedTo) {
      return res.status(400).json({
        error: "Incident already assigned",
      });
    }

    // 4️⃣ Enforce responder active load (max 2)
    const activeCount = await IncidentModel.countActiveIncidentsForResponder(
      responderId
    );

    if (activeCount >= 2) {
      return res.status(400).json({
        error: "Maximum 2 active incidents allowed",
      });
    }

    // 5️⃣ Decide next status:
    // - pending_review -> triaged (provisional)
    // - verified -> assigned
    const nextStatus =
      incident.status === "pending_review" ? "triaged" : "assigned";

    const updatePatch = {
      assignedTo: responderId,
      assignedAt: new Date().toISOString(),
      status: nextStatus,
    };

    // If responder picked an unverified incident -> store triage metadata
    if (nextStatus === "triaged") {
      updatePatch.triagedBy = responderId;
      updatePatch.triagedAt = new Date().toISOString();
      updatePatch.triageSource = "responder";
      // optional: allow responder note later via separate endpoint
      updatePatch.triageNote = null;
    }

    const updated = await IncidentModel.updateIncident(id, updatePatch);

    return res.json({
      success: true,
      message:
        nextStatus === "triaged"
          ? "Incident triaged and assigned to responder"
          : "Incident picked successfully",
      incident: updated,
      mode: nextStatus, 
    });
  } catch (err) {
    console.error("responderPickIncident error:", err);
    return res.status(500).json({
      error: "Failed to pick incident",
    });
  }
};
/**
 * =====================================
 * Admin verifies triaged incident
 * PATCH /api/incidents/:id/verify-triaged
 * =====================================
 */
export const verifyTriagedIncident = async (req, res) => {
  try {
    const { id } = req.params;

    const incident = await IncidentModel.getIncidentById(id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    if (incident.status !== "triaged") {
      return res.status(400).json({
        error: "Only triaged incidents can be verified",
      });
    }

    const updated = await IncidentModel.updateIncident(id, {
      status: "assigned",
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: "Triaged incident verified successfully",
      incident: updated,
    });
  } catch (err) {
    console.error("verifyTriagedIncident error:", err);
    return res.status(500).json({
      error: "Failed to verify triaged incident",
    });
  }
};