import express from "express";
import { getRiskOverlay } from "../controllers/riskOverlayController.js";

const router = express.Router();

router.get("/risk-overlay", getRiskOverlay);

export default router;