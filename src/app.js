import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./config/firebase.js"; 
import authRoutes from "./routes/authRoutes.js";
import incidentRoutes from "./routes/incidentRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import devUserRoutes from "./routes/devUserRoutes.js";
import riskOverlayRoutes from "./routes/riskOverlayRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

dotenv.config();

const app = express();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "resqmap-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dev/users", devUserRoutes);
app.use("/api", riskOverlayRoutes);
app.use("/api/reports", reportRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
