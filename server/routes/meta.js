import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { KPI_CONTRACTS } from "../shared/kpiContracts.js";
import { getTree, flattenHypothesisNodes, listTrees, treeExists, setTree, createTree, addNode, editNode, deleteNode } from "../shared/driverTrees.js";
import { CONFIDENCE_WEIGHTS, CONFIDENCE_CONTRADICTION_PENALTY, CONFIDENCE_TIER_HIGH, CONFIDENCE_TIER_MEDIUM, listPersonas, getAiEngineStatus } from "../ai_engine/index.js";
import { computeCalibration } from "../analytics/calibration.js";

const router = Router();
router.use(requireAuth);

// P3: single source of truth for the KPI list. The frontend used to
// hardcode this in Feedback.jsx / Dashboard.jsx.
router.get("/kpis", (req, res) => {
  res.json(
    Object.values(KPI_CONTRACTS).map((c) => ({ id: c.id, name: c.name, unit: c.unit, businessWeight: c.businessWeight }))
  );
});

// P3: regions come from the currently loaded dataset, not a static
// frontend list, reflects synthetic/csv/live + region-mapping mode.
router.get("/regions", (req, res) => {
  const dataset = req.activeDataset;
  res.json(dataset.regions);
});

// P3: hypotheses are derived live from the KPI's driver tree ,
// replaces the hardcoded HYPOTHESES array in Feedback.jsx. Directly
// demonstrates P0: there is no separate hypothesis list anywhere.
router.get("/hypotheses", (req, res) => {
  const kpiId = KPI_CONTRACTS[req.query.kpi] ? req.query.kpi : "revenue";
  const tree = getTree(kpiId);
  const leaves = flattenHypothesisNodes(tree);
  res.json(leaves.map((n) => ({ id: n.id, label: n.label, metricKey: n.metricKey })));
});

router.get("/personas", (req, res) => {
  res.json(listPersonas());
});

// P5: expose the confidence model's configuration so it's
// inspectable, not just its per-request output components.
router.get("/confidence-config", (req, res) => {
  res.json({
    weights: CONFIDENCE_WEIGHTS,
    contradictionPenalty: CONFIDENCE_CONTRADICTION_PENALTY,
    tierThresholds: { high: CONFIDENCE_TIER_HIGH, medium: CONFIDENCE_TIER_MEDIUM },
    disclaimer: "Confidence in hypothesis, not a probability of causality.",
    configuredVia: "environment variables, see server/.env.example",
  });
});

// P0#2, driver trees are runtime-configurable data, not a JS
// constant. GET is read-only for everyone authenticated; write
// endpoints are restricted to analyst/executive roles (a manager
// shouldn't be able to redefine company-wide driver semantics from
// a region-scoped account).
router.get("/driver-trees", (req, res) => {
  res.json(listTrees());
});

router.get("/driver-trees/:kpi", (req, res) => {
  if (!treeExists(req.params.kpi)) return res.status(404).json({ error: `No driver tree for KPI: ${req.params.kpi}` });
  res.json(getTree(req.params.kpi));
});

function requireGovernanceRole(req, res, next) {
  if (req.user.role !== "analyst" && req.user.role !== "executive") {
    return res.status(403).json({ error: "Only analyst/executive roles may modify driver-tree configuration." });
  }
  next();
}

router.post("/driver-trees", requireGovernanceRole, (req, res) => {
  const { kpiId, tree } = req.body;
  if (!kpiId || !tree) return res.status(400).json({ error: "kpiId and tree are required" });
  try {
    res.json({ ok: true, tree: createTree(kpiId, tree) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/driver-trees/:kpi", requireGovernanceRole, (req, res) => {
  try {
    res.json({ ok: true, tree: setTree(req.params.kpi, req.body) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Adds one node under an existing parent, this is the endpoint
// that proves the point: POST a node here (e.g. Revenue ->
// Operational -> "Warehouse Capacity"), and the very next
// /api/kpi/revenue/story call will include it as a hypothesis,
// with zero changes to the Hypothesis Engine.
router.post("/driver-trees/:kpi/nodes", requireGovernanceRole, (req, res) => {
  const { parentNodeId, node } = req.body;
  if (!parentNodeId || !node) return res.status(400).json({ error: "parentNodeId and node are required" });
  try {
    res.json({ ok: true, tree: addNode(req.params.kpi, parentNodeId, node) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/driver-trees/:kpi/nodes/:nodeId", requireGovernanceRole, (req, res) => {
  try {
    res.json({ ok: true, tree: editNode(req.params.kpi, req.params.nodeId, req.body) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/driver-trees/:kpi/nodes/:nodeId", requireGovernanceRole, (req, res) => {
  try {
    res.json({ ok: true, tree: deleteNode(req.params.kpi, req.params.nodeId) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// P0#1: reconciliation quality metrics, records matched/unmatched,
// match rate, region-mapping table, produced by the actual
// reconciliation layer at dataset load time (data/reconciliation/
// reconcile.js), not simulated for display purposes.
router.get("/reconciliation", (req, res) => {
  const dataset = req.activeDataset;
  if (!dataset.reconciliationReport) {
    return res.json({ available: false, note: "Current DATA_SOURCE mode does not go through the heterogeneous-source reconciliation layer (that applies to DATA_SOURCE=synthetic)." });
  }
  res.json({ available: true, rawSourceCounts: dataset.rawSourceCounts, ...dataset.reconciliationReport });
});

// P1#4, confidence calibration: bucketed accuracy + Brier score
// computed from confirmed historical scenarios. Explicitly refuses
// to pretend statistical meaning with too few examples.
router.get("/confidence-calibration", (req, res) => {
  res.json(computeCalibration());
});

// AI ENGINE STATUS PANEL, which AI Intelligence Engine components
// are wired and ready. See ai_engine/index.js for what "ready"
// actually verifies.
router.get("/ai-engine-status", (req, res) => {
  res.json(getAiEngineStatus());
});

export default router;
