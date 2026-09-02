// ============================================================
// P1#4, CONFIDENCE CALIBRATION
// Uses confirmed historical scenarios (store/scenarios.js) to
// check whether confidence scores actually correlated with being
// right. Deliberately NOT "sophisticated online ML" per the
// instructions, this is a bucketed accuracy count plus an
// optional Brier score, both standard, simple, and honest about
// small-N unreliability.
//
// "Correct" is judged by comparing the top hypothesis AT THE TIME
// OF PROPOSAL against the confirmedCause an analyst later supplied
//, a real correctness signal grounded in what was actually
// confirmed, not a self-referential check against the system's own
// output.
// ============================================================

import { listConfirmedScenarios } from "../store/scenarios.js";
import { getScenario } from "../store/scenarios.js";
import { round } from "./engine.js";

const MIN_FOR_CALIBRATION = 5; // below this, bucket accuracy is not statistically meaningful

function wasTopHypothesisCorrect(scenario) {
  // scenario.hypotheses[0] is the top-ranked hypothesis captured at
  // proposeScenario() time; confirmedCause is what an analyst later
  // verified actually happened. Same lightweight keyword-overlap
  // check used elsewhere in the app (historicalBoostFor), simple
  // and consistent, not a second bespoke matching algorithm.
  const top = scenario.hypotheses?.[0];
  if (!top || !scenario.confirmedCause) return null;
  const causeLower = scenario.confirmedCause.toLowerCase();
  const labelWords = top.label.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  return labelWords.some((w) => causeLower.includes(w));
}

function bucketFor(confidence) {
  if (confidence >= 80) return "HIGH";
  if (confidence >= 50) return "MEDIUM";
  return "LOW";
}

export function computeCalibration() {
  // listConfirmedScenarios() reshapes for the historical-similarity
  // matcher and drops the raw `hypotheses`/`confirmedCause` fields
  // calibration needs, read the full confirmed records directly.
  const allConfirmed = listConfirmedScenarios().map((s) => getScenario(s.id)).filter(Boolean);

  if (allConfirmed.length < MIN_FOR_CALIBRATION) {
    return {
      available: false,
      confirmedOutcomeCount: allConfirmed.length,
      minimumRequired: MIN_FOR_CALIBRATION,
      message: "Insufficient confirmed outcomes for calibration.",
    };
  }

  const evaluated = allConfirmed
    .map((s) => ({
      id: s.id,
      confidence: s.hypotheses?.[0]?.confidence ?? null,
      correct: wasTopHypothesisCorrect(s),
    }))
    .filter((e) => e.confidence != null && e.correct != null);

  const buckets = { HIGH: [], MEDIUM: [], LOW: [] };
  evaluated.forEach((e) => buckets[bucketFor(e.confidence)].push(e));

  const bucketStats = Object.fromEntries(
    Object.entries(buckets).map(([tier, items]) => {
      const n = items.length;
      const correctCount = items.filter((i) => i.correct).length;
      return [
        tier,
        {
          n,
          correctCount,
          accuracyPct: n ? round((correctCount / n) * 100, 1) : null,
          reliable: n >= 3, // even a bucket needs a few points before its accuracy% means anything
        },
      ];
    })
  );

  // Brier score: mean squared error between stated confidence (as a
  // 0-1 probability-like number, though it's explicitly NOT a
  // probability of causality elsewhere in the app) and the binary
  // correctness outcome. Lower is better; 0 = perfect, 0.25 = no
  // better than always guessing 50%.
  const brierScore = round(
    evaluated.reduce((sum, e) => sum + ((e.confidence / 100) - (e.correct ? 1 : 0)) ** 2, 0) / evaluated.length,
    4
  );

  return {
    available: true,
    confirmedOutcomeCount: allConfirmed.length,
    evaluatedCount: evaluated.length,
    buckets: bucketStats,
    brierScore,
    brierScoreNote: "0 = perfect calibration, 0.25 = no better than a coin flip, 1 = perfectly wrong. Treat as directional with this sample size, not a precise statistic.",
    disclaimer:
      evaluated.length < 15
        ? `Only ${evaluated.length} evaluated outcomes, bucket accuracy and Brier score are illustrative, not statistically reliable. Treat "confidence score" (stated at investigation time) and "calibrated historical accuracy" (measured after the fact) as two different numbers; more confirmed scenarios narrow the gap between what the system claims and what it can prove.`
        : `${evaluated.length} evaluated outcomes. "Confidence score" is stated at investigation time; "calibrated historical accuracy" below is measured after the fact from confirmed outcomes, these are two different numbers, not one restated.`,
  };
}
