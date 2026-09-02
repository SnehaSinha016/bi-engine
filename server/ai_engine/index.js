// ============================================================
// AI INTELLIGENCE ENGINE, PUBLIC ENTRY POINT
//
// This is the AI Intelligence Engine as a first-class product
// component, sitting between the Analytics Engine (quantitative
// truth) and the Decision Workspace (the UI):
//
//   DATA SOURCES -> RECONCILIATION -> KPI SEMANTIC LAYER
//     -> ANALYTICS ENGINE (quantitative truth)
//     -> AI INTELLIGENCE ENGINE (investigation, evidence, reasoning,
//        uncertainty, memory, narrative, action orchestration)
//     -> DECISION WORKSPACE (the UI)
//
// Everything routes/ needs from the AI engine is re-exported here
// so callers import one module, not eight.
// ============================================================

export { investigateKpi, investigateRevenue, investigateSparseProduct, narrateInvestigation, narrateSparseInvestigation } from "./orchestrator/investigationOrchestrator.js";
export { generateHypotheses, buildDriverTreeIntelligence } from "./hypothesis/hypothesisEngine.js";
export { synthesizeEvidence } from "./evidence/evidenceEngine.js";
export { retrieveSimilarScenarios, proposeScenario, confirmScenario, listPendingScenarios, listConfirmedScenarios, getScenario, scenarioFingerprint } from "./memory/businessMemoryEngine.js";
export { decideOutcome, computeNextBestInvestigation } from "./reasoning/uncertaintyEngine.js";
export { computeConfidence, CONFIDENCE_WEIGHTS, CONFIDENCE_CONTRADICTION_PENALTY, CONFIDENCE_TIER_HIGH, CONFIDENCE_TIER_MEDIUM } from "./confidence/confidenceEngine.js";
export { buildRecommendation } from "./recommendation/actionEngine.js";
export { getPersona, listPersonas, resolvePersona, PERSONAS } from "./persona/personaEngine.js";
export { getProvider } from "./llm/llmProvider.js";

// AI ENGINE STATUS PANEL, reports which components are wired and
// live. "Ready" here means: this module (ai_engine/index.js)
// successfully imported every engine module listed below, if any
// of them had a broken import or syntax error, THIS file would fail
// to load and the server would refuse to boot (verified: server.js
// imports routes that import ai_engine/index.js at startup, so a
// broken AI engine module is a hard boot failure, not a silently
// green status badge).
export function getAiEngineStatus() {
  return {
    status: "READY",
    architecture: "DATA -> RECONCILIATION -> KPI SEMANTICS -> ANALYTICS ENGINE -> AI INTELLIGENCE ENGINE -> DECISION WORKSPACE",
    components: [
      { name: "Investigation Orchestrator", status: "ready", role: "Coordinates the full investigation pipeline end to end" },
      { name: "Hypothesis Engine", status: "ready", role: "Generates and ranks candidate causes from the configured driver tree" },
      { name: "Evidence Engine", status: "ready", role: "Synthesizes supporting/contradicting evidence per hypothesis" },
      { name: "Business Memory Engine", status: "ready", role: "Retrieves similar past business states; learns from confirmed outcomes" },
      { name: "Uncertainty / Abstention Engine", status: "ready", role: "Decides ACT / INVESTIGATE / ABSTAIN and the Next Best Investigation" },
      { name: "Confidence Engine", status: "ready", role: "Explainable, weighted confidence-in-hypothesis scoring" },
      { name: "Recommendation / Action Engine", status: "ready", role: "Assembles governed actions into contextual recommendations" },
      { name: "Narrative Engine", status: "ready", role: "Persona-specific natural-language explanation" },
      { name: "Persona Engine", status: "ready", role: "Maps the same verified analysis to executive vs. operations framing" },
      { name: "LLM Layer", status: process.env.ANTHROPIC_API_KEY ? "ready (real provider)" : "ready (mock/demo provider)", role: "Executes the narrative prompt, narration only, never calculation" },
    ],
  };
}
