// ============================================================
// AI INTELLIGENCE ENGINE, NARRATIVE ENGINE
//
// Responsibility: builds a PERSONA-SPECIFIC prompt from the
// already-computed personaView (see personaEngine.js), never raw
// data, and calls the LLM layer to produce natural-language text.
// The three personas get genuinely different prompts built from
// genuinely different fields, not the same prompt with a "keep it
// short" instruction bolted on.
// ============================================================

import { generateWithFallback } from "../llm/llmProvider.js";

const SYSTEM_PROMPT = `You are a business-intelligence narrator embedded in a KPI investigation platform.
You are given ONLY pre-computed, deterministic facts, numbers have already been calculated by
non-LLM analytics code. You must never invent, recompute, or alter any number.
Rules:
- Clearly separate FACTS (measured) from HYPOTHESES (leading explanation) from UNCERTAINTY.
- Never state a hypothesis as proven causation. Use language like "is the strongest supported
  hypothesis," never "caused."
- Confidence is a confidence-in-hypothesis score, never a "probability of causality."
- If the input says the decision is AMBIGUOUS, explicitly say the root cause is ambiguous.
- If NOVEL PATTERN, say so explicitly. If historical baseline is insufficient, say so.
- If IMPACT says "unavailable," say so plainly rather than guessing a number.
- Match the requested persona's actual information need (given below), do not simply write the
  same content shorter or longer. An EXECUTIVE prompt gives you compact decision-support facts;
  write a decision-first summary. An ANALYST prompt gives you the full driver ranking, evidence
  per source, alternative hypotheses, and lineage; write a technical, evidence-dense narrative that
  uses ALL of that detail, not just the top line. An OPERATIONS prompt gives you the operational
  driver, lever, and immediate action; write a terse, action-first operational brief.`;

function buildExecutivePrompt(insight) {
  const v = insight.personaView;
  return [
    `PERSONA: executive`,
    `WHAT_CHANGED: ${v.whatChanged}`,
    `WHY: ${v.why}`,
    `CONFIDENCE: ${v.confidence ? `${v.confidence.value}% (${v.confidence.level})` : "n/a"}`,
    `DECISION: ${v.decisionRequired}`,
    `ACTION: ${v.action}`,
    `IMPACT: ${v.impact}`,
    `OWNER: ${v.owner || "n/a"}`,
    `MONITORING: ${v.monitoring || "n/a"}`,
  ].join("\n");
}

function buildOperationsPrompt(insight) {
  const v = insight.personaView;
  return [
    `PERSONA: operations`,
    `OPERATIONAL_DRIVER: ${v.operationalDriver || "none"}`,
    `AFFECTED_REGION: ${v.affectedRegion}`,
    `CONTROLLABLE_LEVER: ${v.controllableLever || "n/a"}`,
    `IMMEDIATE_ACTION: ${v.immediateAction}`,
    `OWNER: ${v.owner || "n/a"}`,
    `EXPECTED_IMPACT: ${v.expectedImpact}`,
    `MONITORING_PLAN: ${v.monitoringPlan || "n/a"}`,
    `NEXT_BEST_INVESTIGATION: ${v.nextBestInvestigation || "n/a"}`,
  ].join("\n");
}

function buildAnalystPrompt(insight) {
  const v = insight.personaView;
  const rankingLines = v.driverRanking.slice(0, 5).map((h) => `  - ${h.label}: ${h.confidence}% (${h.tier}, ${h.causalTag}), contribution rank ${h.contributionPct}%`).join("\n");
  const altLines = v.alternativeHypotheses.slice(0, 3).map((h) => `  - ${h.label} (${h.confidence}%): ${h.whyRankedLower}`).join("\n");
  const topEvidence = v.evidenceExplorer[0];
  return [
    `PERSONA: analyst`,
    `KPI_TREND: current=${v.kpiTrend.current}, baseline=${v.kpiTrend.baseline}, change=${v.kpiTrend.changePct}%, z=${v.kpiTrend.zScore}, materialityScore=${v.kpiTrend.materialityScore}/100`,
    `DRIVER_RANKING:\n${rankingLines}`,
    `TOP_EVIDENCE: source=${topEvidence?.source}, metric=${topEvidence?.metric}, change=${topEvidence?.change}, alignment=${topEvidence?.alignment}`,
    `SUPPORTING: ${topEvidence?.supporting?.join(" ") || "none"}`,
    `CONTRADICTING: ${topEvidence?.contradicting?.join(" ") || "none"}`,
    `CONFIDENCE_BREAKDOWN: ${v.confidenceBreakdown ? JSON.stringify(v.confidenceBreakdown.checks) : "n/a"}`,
    `ALTERNATIVE_HYPOTHESES:\n${altLines || "  none"}`,
    `LINEAGE: ${v.lineage || "n/a"}`,
    `HISTORICAL_MEMORY: ${v.historicalMemory?.isNovel ? "novel pattern, no match" : `${v.historicalMemory?.best?.similarity ?? 0}% match to "${v.historicalMemory?.best?.title ?? "none"}"`}`,
    `NEXT_BEST_INVESTIGATION: ${v.nextBestInvestigation?.text || "n/a"}`,
  ].join("\n");
}

function buildPrompt(insight) {
  if (insight.persona === "analyst") return buildAnalystPrompt(insight);
  if (insight.persona === "operations") return buildOperationsPrompt(insight);
  return buildExecutivePrompt(insight);
}

export async function narrateInsight(insight) {
  const userPrompt = buildPrompt(insight);
  const result = await generateWithFallback({ system: SYSTEM_PROMPT, user: userPrompt, persona: insight.persona, personaView: insight.personaView });
  return {
    narrative: result.text,
    isMock: result.isMock,
    providerType: result.providerType,
    narrativeSource: result.narrativeSource,
    fallbackReason: result.fallbackReason || null,
    telemetry: {
      model: result.model,
      providerType: result.providerType,
      isMock: result.isMock,
      narrativeSource: result.narrativeSource,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.inputTokens + result.outputTokens,
      tokensAreEstimated: result.tokensAreEstimated,
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
      costLabel: result.costLabel,
      llmCalls: 1,
    },
  };
}

export async function narrateSparse(sparseInsight) {
  const userPrompt = [
    `PERSONA: executive`,
    `KPI: Orders (new product)`,
    `REGION: ${sparseInsight.region}`,
    `CHANGE_PCT: ${sparseInsight.earlyAdoptionGrowthPct}`,
    `DECISION: ${sparseInsight.decision}`,
    `TOP_DRIVER: peer-benchmark comparison`,
    `CONFIDENCE: ${sparseInsight.confidence.overall}`,
    `EVIDENCE_SUMMARY: Days of history: ${sparseInsight.daysOfHistory}/${sparseInsight.minHistoryRequired}. Peer benchmark growth: ${sparseInsight.peerBenchmarkGrowthPct}%.`,
    `UNCERTAINTY: Insufficient historical coverage for standard anomaly detection.`,
  ].join("\n");
  const result = await generateWithFallback({ system: SYSTEM_PROMPT, user: userPrompt, persona: "executive" });
  return {
    narrative: result.text,
    isMock: result.isMock,
    providerType: result.providerType,
    narrativeSource: result.narrativeSource,
    fallbackReason: result.fallbackReason || null,
    telemetry: {
      model: result.model,
      providerType: result.providerType,
      isMock: result.isMock,
      narrativeSource: result.narrativeSource,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.inputTokens + result.outputTokens,
      tokensAreEstimated: result.tokensAreEstimated,
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
      costLabel: result.costLabel,
      llmCalls: 1,
    },
  };
}
