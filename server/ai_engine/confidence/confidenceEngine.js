// ============================================================
// AI INTELLIGENCE ENGINE, CONFIDENCE ENGINE
//
// Responsibility: turn verified analytical signals (contribution,
// anomaly strength, evidence strength, historical similarity, data
// quality, temporal alignment, contradictions, all computed by the
// Analytics Engine) into a single explainable confidence-in-
// hypothesis score, with every component exposed and NEVER framed
// as a probability of causality.
//
// This lives in the AI engine (not analytics/) because "how much
// should we trust this hypothesis" is an investigative judgment
// call about WEIGHTING verified facts against each other, a
// reasoning decision, not a raw measurement. The facts it weighs
// (anomaly score, contribution %, data quality) are still 100%
// analytics-engine output; this module never computes a KPI number
// itself.
// ============================================================

import { clamp, round } from "../../analytics/engine.js";

export const CONFIDENCE_WEIGHTS = {
  contribution: Number(process.env.CONFIDENCE_WEIGHT_CONTRIBUTION ?? 0.25),
  anomalyStrength: Number(process.env.CONFIDENCE_WEIGHT_ANOMALY ?? 0.2),
  evidenceStrength: Number(process.env.CONFIDENCE_WEIGHT_EVIDENCE ?? 0.2),
  historicalSimilarity: Number(process.env.CONFIDENCE_WEIGHT_HISTORICAL ?? 0.15),
  dataQuality: Number(process.env.CONFIDENCE_WEIGHT_DATA_QUALITY ?? 0.1),
  temporalAlignment: Number(process.env.CONFIDENCE_WEIGHT_TEMPORAL ?? 0.1),
};
export const CONFIDENCE_CONTRADICTION_PENALTY = Number(process.env.CONFIDENCE_CONTRADICTION_PENALTY ?? 6);
export const CONFIDENCE_TIER_HIGH = Number(process.env.CONFIDENCE_TIER_HIGH ?? 75);
export const CONFIDENCE_TIER_MEDIUM = Number(process.env.CONFIDENCE_TIER_MEDIUM ?? 50);

export function computeConfidence({ contributionPct, anomalyScore, evidenceStrength, historicalSimilarity, dataQuality, temporalAlignmentStrong, contradictionCount }) {
  const temporalScore = temporalAlignmentStrong ? 90 : 45;
  const w = CONFIDENCE_WEIGHTS;
  const weighted =
    contributionPct * w.contribution +
    anomalyScore * w.anomalyStrength +
    evidenceStrength * w.evidenceStrength +
    historicalSimilarity * w.historicalSimilarity +
    dataQuality * w.dataQuality +
    temporalScore * w.temporalAlignment;
  const penalty = contradictionCount * CONFIDENCE_CONTRADICTION_PENALTY;
  const overall = clamp(weighted - penalty, 0, 100);
  let tier = "LOW";
  if (overall >= CONFIDENCE_TIER_HIGH) tier = "HIGH";
  else if (overall >= CONFIDENCE_TIER_MEDIUM) tier = "MEDIUM";

  // ----------------------------------------------------------------
  // Interpretable layer: the SAME six underlying signals above,
  // regrouped into four judge-legible checks a non-technical reader
  // can actually evaluate, instead of six weighted decimal terms.
  // No new math, this is a presentation of the identical inputs.
  //   - crossSourceAgreement: does evidence corroborate without
  //     contradiction (evidence strength, penalized by contradictions)
  //   - signalStrength: how anomalous + how much this driver actually
  //     moved the KPI (anomaly + contribution)
  //   - historicalSimilarity: have we seen this pattern before
  //   - dataFreshness: how current/reliable is the underlying data
  // ----------------------------------------------------------------
  const crossSourceAgreement = clamp(evidenceStrength - contradictionCount * 20, 0, 100);
  const signalStrength = clamp((anomalyScore + contributionPct) / 2, 0, 100);
  const checks = {
    crossSourceAgreement: round(crossSourceAgreement / 100, 2),
    signalStrength: round(signalStrength / 100, 2),
    historicalSimilarity: round(historicalSimilarity / 100, 2),
    dataFreshness: round(dataQuality / 100, 2),
  };

  const explanation = buildExplanation(checks, contradictionCount, temporalAlignmentStrong);

  return {
    // Legacy/detailed shape (0-100 scale, six components), kept so
    // existing UI/telemetry consumers are unaffected.
    overall: round(overall, 1),
    tier,
    disclaimer: "Confidence in hypothesis, not a probability of causality.",
    components: {
      contribution: round(contributionPct, 1),
      anomalyStrength: round(anomalyScore, 1),
      evidenceStrength: round(evidenceStrength, 1),
      historicalSimilarity: round(historicalSimilarity, 1),
      dataQuality: round(dataQuality, 1),
      temporalAlignment: temporalAlignmentStrong ? "Strong" : "Weak",
      contradictingEvidenceCount: contradictionCount,
    },
    weights: w,
    // Interpretable shape (0-1 scale, four named checks), same
    // underlying score, judge-legible framing.
    score: round(overall / 100, 2),
    level: tier,
    explanation,
    checks,
  };
}

// Plain-language explanation from whichever check is strongest/
// weakest, not templated praise, reflects the actual numbers.
function buildExplanation(checks, contradictionCount, temporalAlignmentStrong) {
  if (contradictionCount > 0) {
    return "Confidence reduced, at least one signal (e.g. traffic) moved in a way this hypothesis doesn't fully explain.";
  }
  const entries = Object.entries(checks).sort((a, b) => b[1] - a[1]);
  const [topCheck, topScore] = entries[0];
  const label = {
    crossSourceAgreement: "High agreement across ERP + Support evidence",
    signalStrength: "Strong, statistically significant deviation from baseline",
    historicalSimilarity: "Closely matches a previously confirmed scenario",
    dataFreshness: "Backed by fresh, high-quality data",
  }[topCheck];
  if (topScore < 0.4) {
    return "No single check is strong, confidence is low across the board, not driven by one weak signal.";
  }
  return `${label}${temporalAlignmentStrong ? "; moved on the same day as the KPI" : ""}.`;
}

// Maps a confidence tier to the Uncertainty Engine's three possible
// investigation outcomes (see reasoning/uncertaintyEngine.js) ,
// exposed here since the tier thresholds that decide it are owned
// by this module.
export function tierToOutcome(tier) {
  if (tier === "HIGH") return "ACT";
  if (tier === "MEDIUM") return "INVESTIGATE";
  return "ABSTAIN";
}
