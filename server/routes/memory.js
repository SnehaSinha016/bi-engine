import { Router } from "express";
import { requireAuth, regionGuard } from "../auth/middleware.js";
import {
  retrieveSimilarScenarios,
  scenarioFingerprint,
  investigateKpi,
  proposeScenario,
  confirmScenario,
  listPendingScenarios,
  listConfirmedScenarios,
  getScenario,
} from "../ai_engine/index.js";
import { KPI_CONTRACTS } from "../shared/kpiContracts.js";

const router = Router();
router.use(requireAuth, regionGuard);

// Business Memory Engine, retrieval endpoint.
router.get("/", (req, res) => {
  const dataset = req.activeDataset;
  const region = req.effectiveRegion === "all" ? "all" : req.effectiveRegion;
  const match = retrieveSimilarScenarios(dataset, region);

  res.json({
    region,
    currentFingerprint: match.current,
    threshold: match.threshold,
    isNovel: match.isNovel,
    ranked: match.ranked.map((s) => ({
      id: s.id,
      title: s.title,
      date: s.date,
      similarity: s.similarity,
      suspectedDriver: s.suspectedDriver,
      whatHappened: s.whatHappened,
      actionTaken: s.actionTaken,
      outcome: s.outcome,
      actionWorked: s.actionWorked,
      source: s.source || "seed",
    })),
    message: match.isNovel
      ? "No sufficiently similar historical scenario found (searched seed + analyst-confirmed scenarios). This is being treated as a novel pattern, reasoning falls back to current evidence only."
      : `This situation is similar to "${match.best.title}" (${match.best.similarity}% similarity). Historical similarity is supporting evidence only, never proof of the same cause.`,
  });
});

// P2 step 1: snapshot a resolved insight as a pending scenario.
// Anyone can propose; nothing becomes searchable until confirmed.
router.post("/propose", (req, res) => {
  const dataset = req.activeDataset;
  const { kpi, region } = req.body;
  if (!KPI_CONTRACTS[kpi]) return res.status(400).json({ error: `Unknown KPI: ${kpi}` });
  const effectiveRegion = req.effectiveRegion === "all" ? "all" : req.effectiveRegion;
  if (region && region !== effectiveRegion && req.user.regionScope !== "all") {
    return res.status(403).json({ error: "Cannot propose a scenario outside your region scope." });
  }

  const insight = investigateKpi(dataset, kpi, region || effectiveRegion, undefined, req.user.role);
  const fingerprint = scenarioFingerprint(dataset, region || effectiveRegion);

  const driverTreeSummary = flattenSummary(insight.driverTree);

  const record = proposeScenario({
    kpi,
    region: region || effectiveRegion,
    fingerprint,
    driverTreeSummary,
    hypotheses: insight.hypotheses.map((h) => ({ id: h.id, label: h.label, confidence: h.confidence.overall, tier: h.confidence.tier })),
    evidence: insight.topHypothesis ? { supporting: insight.topHypothesis.supporting, contradicting: insight.topHypothesis.contradicting } : null,
    persona: req.user.role,
    proposedBy: req.user.id,
  });

  res.json({ ok: true, scenario: record });
});

function flattenSummary(intelNode, out = []) {
  out.push({ id: intelNode.node.id, label: intelNode.node.label, pctChange: intelNode.metrics.pctChange, isMaterial: intelNode.materiality.isMaterial });
  (intelNode.children || []).forEach((c) => flattenSummary(c, out));
  return out;
}

router.get("/pending", (req, res) => {
  res.json(listPendingScenarios());
});

router.get("/confirmed", (req, res) => {
  res.json(listConfirmedScenarios());
});

// P2 step 2: requires explicit analyst/business-user confirmation ,
// confirmedCause / actionTaken / outcome are all mandatory. Only
// after this does the scenario enter future similarity searches
// (Business Memory learning from confirmed outcomes).
router.post("/:id/confirm", (req, res) => {
  const existing = getScenario(req.params.id);
  if (!existing) return res.status(404).json({ error: "Scenario not found" });
  try {
    const record = confirmScenario(req.params.id, {
      confirmedCause: req.body.confirmedCause,
      actionTaken: req.body.actionTaken,
      outcome: req.body.outcome,
      confirmedBy: req.user.id,
    });
    res.json({ ok: true, scenario: record });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
