// ============================================================
// AI INTELLIGENCE ENGINE, RECOMMENDATION / ACTION ENGINE
//
// Responsibility: map DRIVER -> CONTROLLABLE LEVER -> ACTION ->
// EXPECTED IMPACT -> OWNER -> CONFIDENCE -> MONITORING PLAN.
//
// The action, lever, and base owner are NEVER invented here, they
// come exclusively from the governed catalog (shared/
// actionLibrary.js). Expected impact is NEVER invented either, it
// comes exclusively from the deterministic formulas in
// analytics/impact.js (part of the Analytics Engine, since a
// currency estimate is a verified calculation, not a judgment
// call). What THIS module owns is composing those verified pieces
// into one contextual recommendation, weaving real magnitude,
// region, and confidence into the governed action text, and
// deriving a monitoring plan from the hypothesis's own baseline ,
// exactly the "AI may contextualize using verified evidence, must
// not invent facts" boundary from the brief.
// ============================================================

import { getActionsForDriver, resolveOwner } from "../../shared/actionLibrary.js";
import { estimateImpact } from "../../analytics/impact.js";
import { round } from "../../analytics/engine.js";

function buildContextualRecommendation({ hypothesis, insight, actionEntry, region }) {
  const metricLabel = hypothesis.primaryMetrics.label;
  const metricChange = hypothesis.primaryMetrics.composite
    ? `${hypothesis.primaryMetrics.pctChange} index points`
    : `${Math.abs(hypothesis.primaryMetrics.pctChange)}%`;
  const direction = hypothesis.primaryMetrics.pctChange < 0 ? "decreased" : "increased";
  const regionLabel = region === "all" ? "all regions (aggregated)" : `the ${region} region`;

  const contextSentence = `${metricLabel} ${direction} ${metricChange} in ${regionLabel}, coinciding with a ${Math.abs(insight.change)}% ${insight.kpiName?.toLowerCase() || insight.kpi} ${insight.change < 0 ? "decline" : "increase"} (confidence: ${hypothesis.confidence.overall}%).`;

  return `${contextSentence} ${actionEntry.action}`;
}

function buildMonitoringPlan({ hypothesis, region }) {
  const m = hypothesis.primaryMetrics;
  const regionLabel = region === "all" ? "all-region" : `${region}-region`;
  const direction = m.pctChange < 0 ? "remains below" : "remains above";
  const baselineDisplay = m.composite ? `${round(m.historicalBaseline, 2)} index` : formatMetricValue(m);
  // 1.5 is the same statistical-significance z-threshold
  // materialityCheck itself uses (Analytics Engine), reused for
  // consistency rather than inventing a second, unrelated threshold.
  return `Monitor ${regionLabel} ${m.label.toLowerCase()} for 7 days. Alert if it ${direction} 1.5 standard deviations of its baseline (${baselineDisplay}).`;
}

function formatMetricValue(m) {
  if (m.unit === "percent") return `${round(m.historicalBaseline * 100, 2)}%`;
  if (m.unit === "currency") return `\u20B9${Math.round(m.historicalBaseline).toLocaleString("en-IN")}`;
  return String(round(m.historicalBaseline, 2));
}

// The single entry point routes/action.js and the orchestrator use:
// given the winning hypothesis, assembles the complete DRIVER ->
// LEVER -> ACTION -> IMPACT -> OWNER -> MONITORING package.
export function buildRecommendation({ dataset, region, insight, hypothesis }) {
  const impact = estimateImpact(dataset, region, hypothesis.node);
  const actions = getActionsForDriver(hypothesis.driverNodeId).map((a) => {
    const monitoringPlan = buildMonitoringPlan({ hypothesis, region });
    return {
      ...a,
      owner: resolveOwner(a.owner, region),
      confidence: hypothesis.confidence.overall,
      expectedImpact: impact.text,
      impactDetail: impact,
      contextualRecommendation: buildContextualRecommendation({ hypothesis, insight, actionEntry: a, region }),
      monitoringPlan,
      monitoring: monitoringPlan, // Part 1 mandated field name, same value
      // Part 1's exact requested shape, self-contained for API
      // consumers that only want the strict structure:
      // { driver, lever, action, expectedImpact, owner, confidence, monitoring }
      structured: {
        driver: hypothesis.label,
        lever: a.lever,
        action: a.action,
        expectedImpact: impact.text,
        owner: resolveOwner(a.owner, region),
        confidence: hypothesis.confidence.score, // 0-1 scale
        monitoring: monitoringPlan,
      },
    };
  });
  return { driver: hypothesis.label, actions };
}
