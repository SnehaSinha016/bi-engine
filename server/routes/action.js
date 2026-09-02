import { Router } from "express";
import { requireAuth, regionGuard } from "../auth/middleware.js";
import { investigateKpi } from "../ai_engine/index.js";
import { KPI_CONTRACTS } from "../shared/kpiContracts.js";

const router = Router();
router.use(requireAuth, regionGuard);

router.get("/", (req, res) => {
  const dataset = req.activeDataset;
  const kpiId = KPI_CONTRACTS[req.query.kpi] ? req.query.kpi : "revenue";
  const region = req.effectiveRegion === "all" ? "all" : req.effectiveRegion;
  // Recommendation/Action Engine already assembled the full package
  // inside the orchestrator when the decision is RECOMMEND_ACTION ,
  // this route just surfaces it, it doesn't build anything itself.
  const insight = investigateKpi(dataset, kpiId, region, req.query.persona, req.user.role);

  if (insight.decision !== "RECOMMEND_ACTION" || !insight.recommendation) {
    return res.json({
      kpi: kpiId,
      region,
      decision: insight.decision,
      decisionReason: insight.decisionReason,
      actions: [],
      note: "No action is recommended yet, see decisionReason. The system does not force a recommendation without sufficient confidence.",
    });
  }

  res.json({ kpi: kpiId, region, decision: insight.decision, driver: insight.recommendation.driver, actions: insight.recommendation.actions });
});

export default router;
