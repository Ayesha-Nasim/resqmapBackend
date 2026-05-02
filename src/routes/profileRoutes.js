import express from "express";
import { getProfile, updateProfile, getResponders } from "../controllers/profileController.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// ✅ IMPORTANT: specific routes FIRST
router.get("/responders", verifyToken, requireRole(["admin"]), getResponders);

// then generic param routes
router.get("/:id", getProfile);
router.put("/:id", updateProfile);

export default router;
