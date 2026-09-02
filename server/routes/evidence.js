import { Router } from "express";
import { requireAuth, regionGuard, canSeeDetail } from "../auth/middleware.js";
import { investigateKpi } from "../ai_engine/index.js";
import { dataQualityScore } from "../analytics/engine.js";
import { getContract, KPI_CONTRACTS } from "../shared/kpiContracts.js";

const router = Router();
router.use(requireAuth, regionGuard);

router.get("/", (req, res) => {
  const dataset = req.activeDataset;
  const kpiId = KPI_CONTRACTS[req.query.kpi] ? req.query.kpi : "revenue";
  const region = req.effectiveRegion === "all" ? "all" : req.effectiveRegion;
  const contract = getContract(kpiId);
  const insight = investigateKpi(dataset, kpiId, region);
  const dq = dataQualityScore(dataset, contract.sources);
  const detailed = canSeeDetail(req.user);

  const hypotheses = insight.hypotheses.map((h) => ({
    id: h.id,
    label: h.label,
    confidence: h.confidence,
    supporting: h.supporting,
    contradicting: h.contradicting,
    evidence: {
      ticketCount: h.evidence.ticketCount,
      avgSentiment: h.evidence.avgSentiment,
      // raw ticket text (lineage-level detail) only for analysts
      sample: detailed ? h.evidence.sample : undefined,
    },
    lineage: {
      source: h.supportCategories?.length ? "Customer Support" : "ERP",
      metric: h.primaryMetrics.label,
      calculation: `z-score + % deviation vs. baseline (adaptive threshold ${insight.materiality.threshold ?? "n/a"}%)`,
    },
  }));

  res.json({
    kpi: kpiId,
    region,
    freshness: dq,
    lineage: {
      [kpiId]: { source: contract.sources.join(" + "), calculation: contract.formula },
      complaints: { source: "Customer Support", calculation: "ticket volume by category, region" },
    },
    hypotheses,
    detailedAccess: detailed,
  });
});

export default router;
