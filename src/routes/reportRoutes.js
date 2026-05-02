import express from "express";
import { getAdminReportsSummary } from "../controllers/reportController.js";
import { verifyToken } from "../middleware/verifyToken.js";
const router = express.Router();

// add your auth/admin middleware here if you already have it
router.get("/summary", verifyToken, getAdminReportsSummary);

export default router;