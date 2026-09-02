import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { listTelemetry, telemetrySummary } from "../store/db.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  res.json({ summary: telemetrySummary(), recent: listTelemetry(30) });
});

export default router;
