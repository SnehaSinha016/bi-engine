import { Router } from "express";
import { requireAuth, regionGuard } from "../auth/middleware.js";
import { KPI_CONTRACTS, getContract } from "../shared/kpiContracts.js";
import { computeNodeMetrics, materialityCheck, dataQualityScore } from "../analytics/engine.js";
import { investigateKpi, investigateSparseProduct, buildDriverTreeIntelligence, narrateInvestigation, narrateSparseInvestigation } from "../ai_engine/index.js";
import { addTelemetry } from "../store/db.js";

const router = Router();
router.use(requireAuth, regionGuard);

const ROOT_METRIC_KEY = { revenue: "revenue", orders: "orders", conversion: "conversion", aov: "aov", churn: "churnRate" };

router.get("/dashboard", (req, res) => {
  const dataset = req.activeDataset;
  const region = req.effectiveRegion === "all" ? "all" : req.effectiveRegion;
  const dq = dataQualityScore(dataset, ["ERP", "CRM", "Support"]);

  const cards = Object.values(KPI_CONTRACTS).map((contract) => {
    const metricKey = ROOT_METRIC_KEY[contract.id];
    const metrics = computeNodeMetrics(dataset, region, metricKey);
    const materiality = materialityCheck(contract.id, contract, metrics);
    return {
      kpiId: contract.id,
      name: contract.name,
      unit: contract.unit,
      currentValue: metrics.currentValue,
      pctChange: metrics.pctChange,
      trend: metrics.trend,
      materiality,
      priority: materiality.level,
    };
  });

  res.json({ region, cards, freshness: dq, canDrilldown: req.user.regionScope === "all", provenance: dataset.provenance });
});

// Every step of this route is delegated to the AI Intelligence
// Engine's Investigation Orchestrator (ai_engine/orchestrator/) ,
// works identically for all 5 KPIs, no per-KPI special case here.
router.get("/:kpiId/story", async (req, res) => {
  const dataset = req.activeDataset;
  const { kpiId } = req.params;
  if (!KPI_CONTRACTS[kpiId]) return res.status(404).json({ error: `Unknown KPI: ${kpiId}` });

  const region = req.effectiveRegion === "all" ? "all" : req.effectiveRegion;

  const t0 = Date.now();
  const insight = investigateKpi(dataset, kpiId, region, req.query.persona, req.user.role);
  let narrativeResult = { narrative: null, isMock: null, providerType: null, narrativeSource: null, fallbackReason: null, telemetry: { llmCalls: 0, totalTokens: 0, latencyMs: 0, estimatedCostUsd: 0 } };
  try {
    narrativeResult = await narrateInvestigation(insight);
  } catch (e) {
    // generateWithFallback() (see ai_engine/llm/llmProvider.js) already
    // falls all the way through to the deterministic mock provider on
    // any real-provider failure, so this catch should be unreachable
    // in normal operation, it exists only as a last-resort safety net
    // (P10: a Gemini/Anthropic failure must never surface a raw error
    // or break the page). If it ever fires, show a clean, honest
    // message, never the raw exception text as if it were a narrative.
    narrativeResult.narrative = "A narrative could not be generated for this investigation. All quantitative results above are unaffected, the narrative layer is display-only.";
    narrativeResult.narrativeSource = "error-fallback";
    narrativeResult.isMock = true;
  }
  const totalLatency = Date.now() - t0;

  addTelemetry({
    insightType: "kpi_story",
    kpi: kpiId,
    region,
    persona: insight.persona,
    ...narrativeResult.telemetry,
    llmLatencyMs: narrativeResult.telemetry.latencyMs,
    latencyMs: totalLatency,
    analyticsLatencyMs: totalLatency - narrativeResult.telemetry.latencyMs,
  });

  res.json({
    ...insight,
    narrative: narrativeResult.narrative,
    aiProvider: {
      isMock: narrativeResult.isMock,
      providerType: narrativeResult.providerType,
      narrativeSource: narrativeResult.narrativeSource,
      fallbackReason: narrativeResult.fallbackReason,
    },
  });
});

router.get("/:kpiId/node/:nodeId", (req, res) => {
  const dataset = req.activeDataset;
  if (!KPI_CONTRACTS[req.params.kpiId]) return res.status(404).json({ error: `Unknown KPI: ${req.params.kpiId}` });
  const region = req.effectiveRegion === "all" ? "all" : req.effectiveRegion;
  const contract = getContract(req.params.kpiId);
  const tree = buildDriverTreeIntelligence(dataset, region, req.params.kpiId, contract);
  const found = findInIntelligenceTree(tree, req.params.nodeId);
  if (!found) return res.status(404).json({ error: "Node not found" });
  res.json({ region, node: found });
});

function findInIntelligenceTree(intelNode, nodeId) {
  if (intelNode.node.id === nodeId) return intelNode;
  for (const c of intelNode.children || []) {
    const found = findInIntelligenceTree(c, nodeId);
    if (found) return found;
  }
  return null;
}

router.get("/sparse/new-product", async (req, res) => {
  if (req.user.regionScope !== "all" && req.user.regionScope !== "west") {
    return res.status(403).json({ error: `Access denied: ${req.user.title} is scoped to the ${req.user.regionScope} region only.` });
  }
  const dataset = req.activeDataset;
  const t0 = Date.now();
  const insight = investigateSparseProduct(dataset);
  let narrativeResult = { narrative: null, isMock: null, providerType: null, narrativeSource: null, fallbackReason: null, telemetry: { llmCalls: 0, totalTokens: 0, latencyMs: 0, estimatedCostUsd: 0 } };
  try {
    narrativeResult = await narrateSparseInvestigation(insight);
  } catch (e) {
    narrativeResult.narrative = "A narrative could not be generated for this investigation. All quantitative results above are unaffected, the narrative layer is display-only.";
    narrativeResult.narrativeSource = "error-fallback";
    narrativeResult.isMock = true;
  }
  addTelemetry({
    insightType: "sparse_history",
    kpi: "orders",
    region: "west",
    ...narrativeResult.telemetry,
    llmLatencyMs: narrativeResult.telemetry.latencyMs,
    latencyMs: Date.now() - t0,
  });
  res.json({
    ...insight,
    narrative: narrativeResult.narrative,
    aiProvider: {
      isMock: narrativeResult.isMock,
      providerType: narrativeResult.providerType,
      narrativeSource: narrativeResult.narrativeSource,
      fallbackReason: narrativeResult.fallbackReason,
    },
  });
});

export default router;
