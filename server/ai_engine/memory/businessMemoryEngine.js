// ============================================================
// AI INTELLIGENCE ENGINE, BUSINESS MEMORY ENGINE
//
// Responsibility: this is the AI engine's organizational/business
// memory. It retrieves similar past business states, shows what was
// done and what happened, and lets confirmed outcomes accumulate
// into future retrieval, never treating similarity as causality.
//
// The similarity MATH (fingerprint + Euclidean distance) is
// deterministic arithmetic, same spirit as the rest of the
// Analytics Engine, but the RETRIEVAL is explicitly framed as this
// module's responsibility because "have we seen this before, and
// does it apply here" is a memory/reasoning function, not a raw KPI
// calculation, per the brief's explicit Business Memory Engine
// section.
//
// Wraps store/scenarios.js (the persistence layer, unchanged) so
// callers get one coherent "business memory" API: retrieve, propose
// a new memory from a resolved investigation, and confirm it.
// ============================================================

import { computeNodeMetrics, round } from "../../analytics/engine.js";
import { proposeScenario, confirmScenario, listPendingScenarios, listConfirmedScenarios, getScenario } from "../../store/scenarios.js";

const FINGERPRINT_KEYS = ["revenue", "conversion", "complaints", "delivery", "traffic"];

// A compact numeric signature of "what the business looked like"
// right now, used to search for similar past states.
export function scenarioFingerprint(dataset, region) {
  const rev = computeNodeMetrics(dataset, region, "revenue");
  const conv = computeNodeMetrics(dataset, region, "conversion");
  const comp = computeNodeMetrics(dataset, region, "complaintRate");
  const del = computeNodeMetrics(dataset, region, "avgDeliveryDays");
  const traf = computeNodeMetrics(dataset, region, "traffic");
  return {
    revenue: rev.pctChange / 100,
    conversion: conv.pctChange / 100,
    complaints: comp.pctChange / 100,
    delivery: del.pctChange / 100,
    traffic: traf.pctChange / 100,
  };
}

// Euclidean distance in fractional-change space (not just cosine/
// direction), so a genuinely different-shaped incident isn't
// misreported as a close historical match.
export function euclideanSimilarity(vecA, vecB, k = 3) {
  let sumSq = 0;
  for (const key of FINGERPRINT_KEYS) {
    const diff = (vecA[key] ?? 0) - (vecB[key] ?? 0);
    sumSq += diff * diff;
  }
  const dist = Math.sqrt(sumSq);
  return round(100 * Math.exp(-k * dist), 1);
}

// Retrieves similar historical business states, searches BOTH the
// curated seed incidents (dataset.historicalScenarios) and any
// analyst-confirmed scenarios accumulated over time. Below the
// similarity threshold, declares NOVEL PATTERN rather than forcing
// a weak match.
export function retrieveSimilarScenarios(dataset, region, similarityThreshold = 65) {
  const current = scenarioFingerprint(dataset, region);
  const confirmed = listConfirmedScenarios();
  const pool = [...dataset.historicalScenarios, ...confirmed];
  const scored = pool
    .map((hs) => ({ ...hs, similarity: euclideanSimilarity(current, hs.fingerprint) }))
    .sort((a, b) => b.similarity - a.similarity);

  const best = scored[0];
  const isNovel = !best || best.similarity < similarityThreshold;
  return { current, ranked: scored, best: best || null, isNovel, threshold: similarityThreshold };
}

// Re-exported so callers only need to import from this one module
// for the full Business Memory API (retrieve + learn from
// confirmed outcomes).
export { proposeScenario, confirmScenario, listPendingScenarios, listConfirmedScenarios, getScenario };
