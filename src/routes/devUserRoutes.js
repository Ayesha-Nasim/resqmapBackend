import express from "express";
import { seedAdmin } from "../controllers/devUserController.js";

const router = express.Router();

router.post("/seed-admin", seedAdmin);

export default router;
