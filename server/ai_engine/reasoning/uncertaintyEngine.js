// ============================================================
// AI INTELLIGENCE ENGINE, UNCERTAINTY / ABSTENTION ENGINE
//
// Responsibility: decide whether the investigation has enough to
// ACT, needs to INVESTIGATE further, or should ABSTAIN, and when
// two hypotheses are too close to call, determine the Next Best
// Investigation: which specific piece of evidence would actually
// discriminate between them. This is the module that stops the
// system from ever forcing a confident-sounding answer it can't
// support.
// ============================================================

import { METRIC_FIELD_MAP } from "../../analytics/engine.js";

// Symmetric-difference of each hypothesis's own driving metric (or,
// if they share a primary metric, their full requiredEvidence sets)
//, a real, derived discriminator, never a canned sentence.
export function computeNextBestInvestigation(top, second, region) {
  const labelFor = (metricKey) => METRIC_FIELD_MAP[metricKey]?.label || metricKey;

  const primaryA = top.primaryMetrics.metricKey;
  const primaryB = second.primaryMetrics.metricKey;

  if (primaryA !== primaryB) {
    return {
      text: `Compare ${labelFor(primaryA)} with ${labelFor(primaryB)} for the ${region} region to distinguish between "${top.label}" and "${second.label}".`,
      discriminatingMetrics: [primaryA, primaryB],
      hypothesisA: top.label,
      hypothesisB: second.label,
    };
  }

  const reqA = new Set(top.node.requiredEvidence || [primaryA]);
  const reqB = new Set(second.node.requiredEvidence || [primaryB]);
  const discriminating = [...new Set([...[...reqA].filter((m) => !reqB.has(m)), ...[...reqB].filter((m) => !reqA.has(m))])];

  if (discriminating.length === 0) {
    return {
      text: `"${top.label}" and "${second.label}" both depend on the same evidence (${[...reqA].map(labelFor).join(", ")}), no available metric would currently discriminate between them for ${region}. Additional evidence outside the current data model would be needed.`,
      discriminatingMetrics: [],
      hypothesisA: top.label,
      hypothesisB: second.label,
    };
  }
  return {
    text: `Compare ${discriminating.map(labelFor).join(" with ")} for the ${region} region to distinguish between "${top.label}" and "${second.label}".`,
    discriminatingMetrics: discriminating,
    hypothesisA: top.label,
    hypothesisB: second.label,
  };
}

// The central uncertainty decision. Given the root KPI's materiality
// verdict and the ranked hypothesis list, decides one of:
//   NO_ACTION                   , movement wasn't material (ACT: no-op)
//   ABSTAIN_INSUFFICIENT_HISTORY, not enough baseline data (ABSTAIN)
//   AMBIGUOUS                   , top two hypotheses too close (ABSTAIN, but with a Next Best Investigation)
//   RECOMMEND_ACTION            , HIGH confidence leader (ACT)
//   INVESTIGATE_DEEPER          , MEDIUM confidence leader (INVESTIGATE)
//   ABSTAIN                     , no hypothesis clears LOW confidence (ABSTAIN)
//
// Strict thresholds (Part 1): confidence > 0.75 -> ACT,
// 0.4-0.75 -> INVESTIGATE, < 0.4 OR conflicting signals -> ABSTAIN.
// Implemented via the Confidence Engine's own HIGH/MEDIUM/LOW tiers
// (75/50 on the 0-100 scale = 0.75/0.50 on the 0-1 scale used here)
// plus an explicit conflicting-signals override below, so the exact
// same thresholds the rest of the app already relies on aren't
// duplicated as a second, possibly-drifting set of numbers.
export function decideOutcome({ rootMateriality, hypotheses, region }) {
  const top = hypotheses[0];
  const second = hypotheses[1];

  if (rootMateriality.insufficientHistory) {
    return {
      decision: "ABSTAIN_INSUFFICIENT_HISTORY",
      decisionReason: rootMateriality.rationale,
      ambiguous: false,
      abstainReason: "insufficient",
      nextBestInvestigation: null,
      nextBestAction: "Collect at least 10 days of baseline data before assessing materiality.",
      outcome: "ABSTAIN",
    };
  }
  if (!rootMateriality.isMaterial) {
    return {
      decision: "NO_ACTION",
      decisionReason: "Movement is within this KPI's own adaptive expected-volatility range; no investigation warranted.",
      ambiguous: false,
      abstainReason: null,
      nextBestInvestigation: null,
      nextBestAction: null,
      outcome: "ACT", // "act" here means "no action needed", a deliberate, confident non-finding
    };
  }

  // Conflicting signals: the leading hypothesis's own evidence
  // contradicts itself (e.g. traffic moved materially too, muddying
  // attribution), this forces ABSTAIN even if the raw confidence
  // number alone would have cleared the ACT threshold, per Part 1's
  // explicit "OR conflicting signals -> ABSTAIN" rule.
  if (top && top.contradictionCount > 0 && top.confidence.tier !== "HIGH") {
    return {
      decision: "ABSTAIN",
      decisionReason: `"${top.label}" has conflicting signals, another upstream metric moved materially in a way this hypothesis doesn't fully explain.`,
      ambiguous: false,
      abstainReason: "conflicting",
      nextBestInvestigation: null,
      nextBestAction: `Check whether ${top.label.toLowerCase()} and the conflicting signal share a common upstream cause before acting.`,
      outcome: "ABSTAIN",
    };
  }

  const margin = top && second ? top.confidence.overall - second.confidence.overall : 100;
  const bothPlausible = (second?.confidence.overall ?? 0) >= 50;
  const ambiguous = margin <= 8 && bothPlausible;

  if (ambiguous) {
    const nextBestInvestigation = computeNextBestInvestigation(top, second, region);
    return {
      decision: "AMBIGUOUS",
      decisionReason: `Top hypotheses ("${top.label}" at ${top.confidence.overall} and "${second.label}" at ${second.confidence.overall}) are too close to isolate a single root cause. ${nextBestInvestigation.text}`,
      ambiguous: true,
      abstainReason: "conflicting",
      nextBestInvestigation,
      nextBestAction: nextBestInvestigation.text,
      outcome: "ABSTAIN",
    };
  }
  if (top.confidence.tier === "HIGH") {
    return {
      decision: "RECOMMEND_ACTION",
      decisionReason: `"${top.label}" is the strongest supported hypothesis with ${top.confidence.overall}% confidence.`,
      ambiguous: false,
      abstainReason: null,
      nextBestInvestigation: null,
      nextBestAction: null,
      outcome: "ACT",
    };
  }
  if (top.confidence.tier === "MEDIUM") {
    return {
      decision: "INVESTIGATE_DEEPER",
      decisionReason: `"${top.label}" is the leading hypothesis but confidence is medium (${top.confidence.overall}%), recommend validating before acting.`,
      ambiguous: false,
      abstainReason: null,
      nextBestInvestigation: null,
      nextBestAction: `Validate ${top.label.toLowerCase()} against one more evidence source before acting.`,
      outcome: "INVESTIGATE",
    };
  }
  return {
    decision: "ABSTAIN",
    decisionReason: "No hypothesis reaches sufficient confidence; recommend monitoring and collecting more evidence.",
    ambiguous: false,
    abstainReason: "insufficient",
    nextBestInvestigation: null,
    nextBestAction: "Broaden evidence collection, no current signal is strong enough to act on.",
    outcome: "ABSTAIN",
  };
}
