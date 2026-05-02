import { db } from "../config/firebase.js";

const incidentsCollection = db.collection("incidents");

export const IncidentModel = {
  // =========================
  // CREATE
  // =========================
  async createIncident(data) {
    const finalDoc = {
      userId: data.userId,

      // -------------------------
      // Core incident fields
      // -------------------------
      type: data.type,
      customType: data.type === "Other" ? (data.customType || null) : null,
      description: data.description || "",

      // -------------------------
      // Location
      // -------------------------
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      fullAddress: data.fullAddress || null,

      // -------------------------
      // Fire-specific fields
      // -------------------------
      subType: data.subType || null,
      peopleAtRisk:
        typeof data.peopleAtRisk === "boolean"
          ? data.peopleAtRisk
          : data.peopleAtRisk === "true"
          ? true
          : data.peopleAtRisk === "false"
          ? false
          : null,

      // -------------------------
      // Evidence (stored, NOT used for severity)
      // -------------------------
      imageUrl: data.imageUrl || null,

      // -------------------------
      // Severity (ML or fallback)
      // -------------------------
      severity: data.severity || "pending",
      severitySource: data.severitySource || null, // "ml" | "fallback"
      severityMeta: data.severityMeta || null, // optional object
      mlConfidence:
        typeof data.mlConfidence === "number" ? data.mlConfidence : null,

      // -------------------------
      // Workflow status
      // -------------------------
      status: data.status || "pending_review", // pending_review | verified | rejected | triaged | assigned | in_progress | resolved

      // -------------------------
      // Admin review metadata
      // -------------------------
      verifiedBy: null,
      verifiedAt: null,

      // -------------------------
      // Responder triage metadata (Option A)
      // -------------------------
      triagedBy: null,
      triagedAt: null,
      triageNote: null,
      triageSource: null, // "responder" (future: "system")

      // -------------------------
      // Assignment + progress
      // -------------------------
      assignedTo: null,
      assignedAt: null,

      // Optional: progress timestamps
      inProgressAt: null,
      resolvedAt: null,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await incidentsCollection.add(finalDoc);
    return { id: docRef.id, ...finalDoc };
  },

  // =========================
  // READ
  // =========================
  async getIncidentById(id) {
    const doc = await incidentsCollection.doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async getAllIncidents() {
    const snap = await incidentsCollection.orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async getIncidentsByUser(userId) {
    const snap = await incidentsCollection.where("userId", "==", userId).get();

    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  },

  // Single version (no duplicates)
  async getIncidentsByStatus(status) {
    const snap = await incidentsCollection.where("status", "==", status).get();

    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  },

  async getRecentIncidents(limitCount = 200) {
    const snap = await incidentsCollection
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // Responder: get incidents assigned to responder
  async getIncidentsAssignedTo(responderId) {
    const snap = await incidentsCollection
      .where("assignedTo", "==", responderId)
      .get();

    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  },

  // Admin: get ALL incidents that are triaged / assigned / in progress / resolved
  async getAllAssignedIncidents() {
    const snap = await incidentsCollection
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return list.filter((i) =>
      ["triaged", "assigned", "in_progress", "resolved"].includes(i.status)
    );
  },

  // =========================
  // UPDATE
  // =========================
  async updateIncident(id, updateData) {
    const exists = await this.getIncidentById(id);
    if (!exists) return null;

    await incidentsCollection.doc(id).update({
      ...updateData,
      updatedAt: new Date(),
    });

    return this.getIncidentById(id);
  },

  async updateIncidentStatus(id, status) {
    // optional: timeline timestamps automatically
    const patch = { status };

    if (status === "in_progress") patch.inProgressAt = new Date();
    if (status === "resolved") patch.resolvedAt = new Date();

    await incidentsCollection.doc(id).update({
      ...patch,
      updatedAt: new Date(),
    });

    return this.getIncidentById(id);
  },

  async updateSeverity(id, severity, extra = {}) {
    await incidentsCollection.doc(id).update({
      severity,
      ...extra,
      updatedAt: new Date(),
    });

    return this.getIncidentById(id);
  },

  // =========================
  // DELETE
  // =========================
  async deleteIncident(id) {
    const exists = await this.getIncidentById(id);
    if (!exists) return false;

    await incidentsCollection.doc(id).delete();
    return true;
  },

  // =========================
  // BUSINESS HELPERS
  // =========================
  // Count active incidents for responder (Option A includes triaged)
  async countActiveIncidentsForResponder(responderId) {
    const snap = await incidentsCollection
      .where("assignedTo", "==", responderId)
      .get();

    // ✅ Active = triaged + assigned + in_progress
    const activeStatuses = ["triaged", "assigned", "in_progress"];

    return snap.docs
      .map((doc) => doc.data())
      .filter((doc) => activeStatuses.includes(doc.status))
      .length;
  },
};