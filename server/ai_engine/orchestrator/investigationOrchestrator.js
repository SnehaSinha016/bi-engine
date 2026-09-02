// ============================================================
// AI INTELLIGENCE ENGINE, INVESTIGATION ORCHESTRATOR
//
// This is the central AI capability: given a KPI movement, it
// decides "what should the AI investigate next?" by coordinating
// every other AI engine module in sequence:
//
//   KPI anomaly (Analytics Engine)
//     -> Driver Tree (Hypothesis Engine walks it)
//     -> node selection / hypothesis generation (Hypothesis Engine)
//     -> evidence gathering (Evidence Engine)
//     -> historical memory (Business Memory Engine)
//     -> confidence scoring (Confidence Engine)
//     -> ambiguity / abstention decision (Uncertainty Engine)
//     -> recommendation (Recommendation / Action Engine)
//     -> persona narrative (Narrative Engine -> LLM Layer)
//
// It also builds the INTELLIGENCE TRACE, an explicit, ordered
// record of which engine did what, shown on the KPI Story page so
// the AI's contribution to the answer is never implicit.
// ============================================================

import { getContract } from "../../shared/kpiContracts.js";
import { getTree } from "../../shared/driverTrees.js";
import { computeNodeMetrics, materialityCheck, dataQualityScore, round } from "../../analytics/engine.js";
import { estimateImpact } from "../../analytics/impact.js";
import { buildDriverTreeIntelligence, generateHypotheses } from "../hypothesis/hypothesisEngine.js";
import { synthesizeEvidence, buildStructuredEvidence } from "../evidence/evidenceEngine.js";
import { retrieveSimilarScenarios } from "../memory/businessMemoryEngine.js";
import { decideOutcome } from "../reasoning/uncertaintyEngine.js";
import { buildRecommendation } from "../recommendation/actionEngine.js";
import { narrateInsight, narrateSparse } from "../narrative/narrativeEngine.js";
import { resolvePersona, buildPersonaView, getPersona } from "../persona/personaEngine.js";

function trace(step, module, description, dataKey = null, status = "done") {
  return { step, module, description, dataKey, status };
}

function countNodes(intelNode) {
  return 1 + (intelNode.children || []).reduce((s, c) => s + countNodes(c), 0);
}

// Generalized investigation entry point, works identically for all
// 5 configured KPIs (Revenue, Orders, Conversion, AOV, Churn). No
// per-KPI special-casing anywhere in this function.
export function investigateKpi(dataset, kpiId, region, personaRequest = null, userRole = "manager") {
  const intelligenceTrace = [];
  const persona = resolvePersona(personaRequest, userRole);
  const contract = getContract(kpiId);
  const tree = getTree(kpiId);

  // --- 1. Analytics Engine: quantitative truth + materiality ---
  const rootMetrics = computeNodeMetrics(dataset, region, tree.metricKey);
  const rootMateriality = materialityCheck(kpiId, contract, rootMetrics);
  const dq = dataQualityScore(dataset, contract.sources);
  intelligenceTrace.push(trace(1, "Materiality Detection", `Calculated ${contract.name} movement (${rootMetrics.pctChange}%) against an adaptive, volatility-aware threshold, result: ${rootMateriality.level}.`, "materiality"));

  // --- 2. Business Memory Engine: has this happened before? ---
  const historicalMatch = retrieveSimilarScenarios(dataset, region);
  intelligenceTrace.push(trace(
    2, "Business Memory",
    historicalMatch.isNovel
      ? "Searched seed + confirmed scenarios, no sufficiently similar past state found (NOVEL PATTERN)."
      : `Found ${historicalMatch.best.similarity}% similar historical scenario: "${historicalMatch.best.title}".`,
    "historicalMemory"
  ));

  // --- 3. Hypothesis Engine: walks the driver tree, generates and
  //        ranks candidate causes. Logged as two named capabilities
  //        (tree traversal, then ranking) since they're separately
  //        visible/demonstrable, even though one function call
  //        produces both. ---
  const driverTree = buildDriverTreeIntelligence(dataset, region, kpiId, contract);
  intelligenceTrace.push(trace(3, "Driver Investigation", `Traversed the ${contract.name} driver tree (${countNodes(driverTree)} nodes) computing materiality/anomaly for every node.`, "driverTree"));

  const rankedHypotheses = generateHypotheses(dataset, region, kpiId, contract, dq, historicalMatch);
  intelligenceTrace.push(trace(4, "Hypothesis Ranking", `Generated and confidence-ranked ${rankedHypotheses.length} candidate hypotheses from the tree's leaf nodes, no fixed cause list.`, "hypotheses"));

  // --- 5. Evidence Engine: supporting/contradicting synthesis ---
  const hypotheses = rankedHypotheses.map((h) => ({
    ...h,
    ...synthesizeEvidence(h),
    structuredEvidence: buildStructuredEvidence(h), // Part 1: {source, metric, change, alignment, timestamp}
  }));
  intelligenceTrace.push(trace(5, "Evidence Synthesis", "Combined ERP/CRM analytics with Support ticket evidence and historical-similarity signal for each hypothesis.", "hypotheses"));

  const top = hypotheses[0];
  const second = hypotheses[1];

  // --- 6. Confidence Engine already ran inside Hypothesis Engine
  //        (each hypothesis needed its own confidence to be ranked)
  //       , logged here since it's a distinct, visible capability.
  if (top) {
    intelligenceTrace.push(trace(6, "Confidence Analysis", `Top hypothesis "${top.label}" confidence = ${top.confidence.overall}% (${top.confidence.tier}). ${top.confidence.disclaimer}`, "topHypothesis"));
  }

  // --- 7/8. Uncertainty / Abstention Engine: what should happen
  //        next, and, only when triggered, the discriminating
  //        Next-Best Investigation. Logged as two items since the
  //        second only fires conditionally; never faked when absent.
  const outcome = decideOutcome({ rootMateriality, hypotheses, region });
  intelligenceTrace.push(trace(7, "Uncertainty Detection", `Decision: ${outcome.decision}. Outcome class: ${outcome.outcome}.`, "decision"));
  if (outcome.nextBestInvestigation) {
    intelligenceTrace.push(trace(8, "Next-Best Investigation", outcome.nextBestInvestigation.text, "nextBestInvestigation"));
  }

  // --- 9. Recommendation / Action Engine: assembled only when
  //        there's a confident enough leader to act on. Impact is
  //        still computed for the top hypothesis either way (from
  //        the Analytics Engine, not invented here) so the KPI Story
  //        page can show it under "what evidence supports it" even
  //        when the decision is AMBIGUOUS or INVESTIGATE_DEEPER. ---
  let recommendation = null;
  if (top) {
    top.impactEstimate = estimateImpact(dataset, region, top.node);
  }
  if (top && outcome.decision === "RECOMMEND_ACTION") {
    recommendation = buildRecommendation({ dataset, region, insight: { kpi: kpiId, kpiName: contract.name, change: rootMetrics.pctChange }, hypothesis: top });
    intelligenceTrace.push(trace(9, "Action Recommendation", `Assembled contextual recommendation from the governed action library for "${top.label}".`, "recommendation"));
  }

  const insight = {
    kpi: kpiId,
    kpiName: contract.name,
    region,
    persona,
    change: rootMetrics.pctChange,
    currentValue: rootMetrics.currentValue,
    baseline: rootMetrics.historicalBaseline,
    // Real daily history for the root KPI, exposed for trend charts ,
    // this was ALREADY computed internally by computeNodeMetrics()
    // (every hypothesis's primaryMetrics already carried it), just
    // never surfaced at the root/insight level until now. One value
    // per date, oldest first; the last point is "today" (same value
    // as currentValue above). Genuinely measured, never interpolated
    // or fabricated, a metric with too little history to chart
    // meaningfully returns an empty array rather than a fake series.
    trend: rootMetrics.insufficientHistory ? [] : rootMetrics.dates.map((date, i) => ({ date, value: rootMetrics.series[i] })),
    materiality: rootMateriality,
    priority: rootMateriality.level,
    dataQuality: dq,
    driverTree,
    hypotheses,
    topHypothesis: top,
    decision: outcome.decision,
    decisionReason: outcome.decisionReason,
    ambiguous: outcome.ambiguous,
    nextBestInvestigation: outcome.nextBestInvestigation,
    novelPattern: historicalMatch.isNovel,
    historicalMemory: historicalMatch,
    recommendation,
    intelligenceTrace,
    method: [
      "materiality: adaptive per-metric volatility threshold + z-score significance (deterministic, Analytics Engine)",
      "anomaly: |z-score| and % deviation from baseline (deterministic, Analytics Engine)",
      "hypotheses: generated dynamically from the KPI driver tree's leaf nodes (deterministic + config-driven, Hypothesis Engine)",
      "contribution: normalized anomaly share among candidate drivers, a relative-ranking signal, not a claimed exact attribution (deterministic, Analytics Engine)",
      "historical similarity: Euclidean distance over a 5-dimension scenario fingerprint, searched over seed + analyst-confirmed scenarios (deterministic, Business Memory Engine)",
      "confidence: configurable weighted combination of contribution, anomaly, evidence, historical similarity, data quality, temporal alignment (deterministic, Confidence Engine)",
      "next-best-investigation: symmetric difference of competing hypotheses' required evidence (deterministic, Uncertainty Engine)",
      "narrative generation only (LLM, Narrative Engine)",
    ],
    createdAt: new Date().toISOString(),
  };

  // Persona Engine: reshapes the SAME insight above into a
  // genuinely different structured view, different fields,
  // different grouping, different depth, not the same object with
  // some fields hidden by the frontend. See personaEngine.js.
  insight.personaView = buildPersonaView(insight, persona);
  intelligenceTrace.push(trace(intelligenceTrace.length + 1, "Persona View", `Reshaped the investigation into the "${getPersona(persona).label}" structured view, different fields and depth, same underlying facts.`, "personaView"));

  // Part 3 (mandatory output format): a compact, spec-shaped summary
  // alongside the full insight above, same underlying data, just
  // pre-shaped to the exact contract requested so a consumer can
  // read one small object instead of the full nested insight.
  insight.summary = buildOutputSummary(insight);

  return insight;
}

// Part 3, mandatory output structure:
// { kpiChange, primaryDriver, confidence, supportingEvidence,
//   alternativeHypotheses, decision, recommendation }
function buildOutputSummary(insight) {
  const top = insight.topHypothesis;
  return {
    kpiChange: `${insight.change > 0 ? "+" : ""}${insight.change}% (${insight.region})`,
    primaryDriver: top ? top.label : null,
    confidence: top ? { score: top.confidence.score, level: top.confidence.level, explanation: top.confidence.explanation } : null,
    supportingEvidence: top ? [top.structuredEvidence] : [],
    alternativeHypotheses: insight.hypotheses.slice(1, 4).map((h) => ({
      label: h.label,
      confidence: h.confidence.score,
      tag: h.causalTag,
    })),
    decision: insight.decision,
    recommendation: insight.recommendation?.actions?.[0]
      ? {
          driver: insight.recommendation.driver,
          lever: insight.recommendation.actions[0].lever,
          action: insight.recommendation.actions[0].action,
          expectedImpact: insight.recommendation.actions[0].expectedImpact,
          owner: insight.recommendation.actions[0].owner,
          confidence: insight.recommendation.actions[0].confidence,
          monitoring: insight.recommendation.actions[0].monitoringPlan,
        }
      : null,
  };
}

// --- 10. Narrative Engine (LLM Layer), separate async step so
//        routes can log its own telemetry distinctly. ---
export async function narrateInvestigation(insight) {
  const result = await narrateInsight(insight);
  insight.intelligenceTrace.push({
    step: 10,
    module: "Persona Narrative",
    description: `Generated ${insight.persona}-specific explanation (${result.isMock ? "mock/demo provider" : "real LLM"}).`,
    dataKey: "narrative",
    status: "done",
  });
  return result;
}

// Back-compat wrapper, existing callers that specifically
// investigate Revenue keep working unchanged.
export function investigateRevenue(dataset, region, persona = "executive") {
  return investigateKpi(dataset, "revenue", region, persona);
}

export function investigateSparseProduct(dataset) {
  const np = dataset.newProduct;
  const daysOfHistory = np.days.length;
  const MIN_HISTORY_DAYS = 14;
  const insufficientHistory = daysOfHistory < MIN_HISTORY_DAYS;

  const ordersSeries = np.days.map((d) => d.orders);
  const first = ordersSeries[0];
  const last = ordersSeries[ordersSeries.length - 1];
  const growth = first ? round(((last - first) / first) * 100, 1) : 0;
  const trend = growth > 5 ? "improving" : growth < -5 ? "declining" : "flat";

  const peerRows = dataset.erp.filter((r) => r.region === np.region).slice(0, 10);
  const peerGrowth = peerRows.length
    ? round(((peerRows[peerRows.length - 1].orders - peerRows[0].orders) / (peerRows[0].orders || 1)) * 100, 1)
    : 0;

  return {
    kpi: "orders",
    product: np.product,
    region: np.region,
    daysOfHistory,
    minHistoryRequired: MIN_HISTORY_DAYS,
    insufficientHistory,
    launchDate: np.launchDate,
    currentOrders: last,
    earlyAdoptionGrowthPct: growth,
    trend,
    peerBenchmarkGrowthPct: peerGrowth,
    confidence: {
      overall: insufficientHistory ? 35 : 65,
      tier: insufficientHistory ? "LOW" : "MEDIUM",
      components: {
        historicalCoverage: `${daysOfHistory}/${MIN_HISTORY_DAYS} days`,
        note: "Confidence capped because historical baseline is insufficient for standard anomaly detection.",
      },
    },
    decision: insufficientHistory ? "ABSTAIN_INSUFFICIENT_HISTORY" : "MONITOR",
    decisionReason: insufficientHistory
      ? "Insufficient historical coverage, standard z-score anomaly detection is not meaningful with under 14 days of data. Falling back to peer-product benchmarking and early adoption trend."
      : "Sufficient history to begin standard monitoring.",
    series: np.days,
    intelligenceTrace: [
      trace(1, "Uncertainty Detection", `Checked historical coverage: ${daysOfHistory}/${MIN_HISTORY_DAYS} days required.`, "confidence"),
      trace(2, "Materiality Detection", "Standard z-score anomaly detection is not meaningful at this history length, computed peer-product benchmark and early-adoption trend as a fallback signal instead.", null),
    ],
    method: [
      "historical coverage check (deterministic, Uncertainty Engine)",
      "peer-product benchmark comparison (deterministic, Analytics Engine)",
      "early-adoption trend slope (deterministic, Analytics Engine)",
      "narrative generation only (LLM, Narrative Engine)",
    ],
  };
}

export async function narrateSparseInvestigation(insight) {
  const result = await narrateSparse(insight);
  insight.intelligenceTrace.push({
    step: 3,
    module: "Persona Narrative",
    description: `Generated explanation (${result.isMock ? "mock/demo provider" : "real LLM"}).`,
    dataKey: "narrative",
    status: "done",
  });
  return result;
}
