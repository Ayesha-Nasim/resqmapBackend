import express from "express";
import {
  submitIncident,
  getPendingIncidents,
  reviewIncident,
  assignIncident,
  getAssignedIncidents,
  getAllAssignedIncidents,
  updateIncidentProgress,
  getVerifiedIncidents,
  getMapIncidents,
  responderPickIncident,
  verifyTriagedIncident,
} from "../controllers/incidentController.js";

import { upload } from "../middleware/upload.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

/**
 * ================================
 * UC-02: Submit Incident (Citizen)
 * ================================
 */
router.post("/submit", upload.single("image"), submitIncident);

/**
 * =====================================
 * UC-03: View Pending Incidents (Admin)
 * =====================================
 */
router.get("/pending", verifyToken, requireRole(["admin"]), getPendingIncidents);

/**
 * =====================================
 * UC-03: Review Incident (Admin Action)
 * =====================================
 */
router.patch("/:id/review", verifyToken, requireRole(["admin"]), reviewIncident);

/**
 * =====================================
 * UC-04: Assign Incident (Admin -> Responder)
 * =====================================
 */
router.patch("/:id/assign", verifyToken, requireRole(["admin"]), assignIncident);

/**
 * =====================================
 * Admin: all assigned/triaged/in_progress/resolved
 * GET /api/incidents/assigned
 * =====================================
 */
router.get("/assigned", verifyToken, requireRole(["admin"]), getAllAssignedIncidents);

/**
 * =====================================
 * UC-05: Responder Views Assigned Incidents
 * GET /api/incidents/assigned/:responderId
 * =====================================
 */
router.get(
  "/assigned/:responderId",
  verifyToken,
  requireRole(["responder", "admin"]),
  getAssignedIncidents
);

/**
 * =====================================
 * UC-06: Responder Updates Incident Status
 * =====================================
 */
router.patch(
  "/:id/progress",
  verifyToken,
  requireRole(["responder", "admin"]),
  updateIncidentProgress
);

/**
 * =====================================
 * Admin: Verified Incidents
 * =====================================
 */
router.get("/verified", verifyToken, requireRole(["admin"]), getVerifiedIncidents);

/**
 * ==========================================
 * Public map incidents
 * ==========================================
 */
router.get("/map", getMapIncidents);

/**
 * =====================================
 * UC-NEW: Responder picks incident (triage/assign)
 * PATCH /api/incidents/:id/pick
 * =====================================
 */
router.patch(
  "/:id/pick",
  verifyToken,
  requireRole(["responder"]),
  responderPickIncident
);

/**
 * =====================================
 * Admin verifies triaged incident
 * PATCH /api/incidents/:id/verify-triaged
 * =====================================
 */
router.patch(
  "/:id/verify-triaged",
  verifyToken,
  requireRole(["admin"]),
  verifyTriagedIncident
);

export default router;