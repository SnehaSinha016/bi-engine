import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { addFeedback, listFeedback } from "../store/db.js";

const router = Router();
router.use(requireAuth);

router.post("/", (req, res) => {
  const { kpi, region, hypothesisId, aiConfidence, verdict, correctedDriver, correctedCause, correctedRecommendation, actualOutcome } = req.body;
  if (!kpi || !region || !verdict) {
    return res.status(400).json({ error: "kpi, region, and verdict are required" });
  }
  const record = addFeedback({
    kpi, region, hypothesisId, aiConfidence, verdict,
    correctedDriver, correctedCause, correctedRecommendation, actualOutcome,
    submittedBy: req.user.id,
  });
  res.json({ ok: true, record });
});

router.get("/", (req, res) => {
  res.json(listFeedback());
});

export default router;
