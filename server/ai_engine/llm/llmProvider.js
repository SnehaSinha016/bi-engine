// ============================================================
// LLM PROVIDER INTERFACE
// The rest of the app only calls provider.generate({system, user}).
// It never knows whether that's a real API call or the mock.
// This is the ONLY place LLM API calls happen in the whole app.
// ============================================================

// ============================================================
// AI INTELLIGENCE ENGINE, LLM LAYER
//
// The ONLY module in the entire application that calls an external
// LLM API. Everything upstream (Analytics Engine, Hypothesis
// Engine, Evidence Engine, Confidence Engine, Business Memory,
// Recommendation Engine) hands this module pre-computed, verified
// facts, it never receives raw data and never computes a KPI
// value, anomaly score, contribution, confidence number, or
// business impact. Its only job is turning already-decided facts
// into natural language (see narrative/narrativeEngine.js, which
// builds the prompt this module executes).
//
// Fallback chain (see getProvider()/generateWithFallback()):
//   Gemini (if configured) --fails--> Anthropic (if configured) --fails--> Mock
// Every result carries an honest `narrativeSource` label
// ("gemini" | "anthropic" | "mock-fallback" | "mock") so the UI
// never claims a real model generated text that a fallback actually
// produced. See routes/kpi.js for how this reaches the response.
// ============================================================

import { GoogleGenAI } from "@google/genai";

class MockProvider {
  constructor() {
    this.name = "mock-deterministic-v1";
    this.providerType = "mock";
  }

  // A template-based stand-in for an LLM: it "narrates" structured
  // facts into prose without inventing any numbers of its own. This
  // keeps the prototype fully runnable with no API key, while still
  // demonstrating the LLM-vs-non-LLM boundary (this function receives
  // ONLY pre-computed facts, never raw data).
  //
  // P0/P1#3: latency is the ACTUAL measured local execution time ,
  // no artificial offset added. A regex-match-and-template-fill is
  // genuinely fast (sub-millisecond), so this number will look
  // nothing like real network+inference latency, which is exactly
  // the point: it should NOT be dressed up to look like a real LLM
  // call. Cost is a fixed, honestly-labeled $0, nothing is computed
  // and then discarded here.
  async generate({ system, user, persona, personaView }) {
    const start = Date.now();
    const text = personaView ? mockNarrateFromView(personaView, persona) : mockNarrate(user, persona);
    const latencyMs = Date.now() - start;
    const inputTokens = estimateTokens(system + user);
    const outputTokens = estimateTokens(text);
    return {
      text,
      model: this.name,
      providerType: "mock",
      isMock: true,
      narrativeSource: "mock",
      inputTokens,
      outputTokens,
      tokensAreEstimated: true,
      latencyMs,
      estimatedCostUsd: 0,
      costLabel: "$0.00, mock provider",
    };
  }
}

class AnthropicProvider {
  constructor(apiKey, model = process.env.LLM_MODEL || "claude-sonnet-4-6") {
    this.apiKey = apiKey;
    this.model = model;
    this.name = model;
    this.providerType = "real";
  }

  async generate({ system, user }) {
    const start = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || "").join("\n");
    const latencyMs = Date.now() - start; // real, measured, end-to-end API latency
    const cost = estimateCost(data.usage);
    return {
      text,
      model: this.model,
      providerType: "real",
      isMock: false,
      narrativeSource: "anthropic",
      inputTokens: data.usage?.input_tokens ?? estimateTokens(system + user),
      outputTokens: data.usage?.output_tokens ?? estimateTokens(text),
      tokensAreEstimated: !data.usage, // real API always returns usage; only estimated if it somehow didn't
      latencyMs,
      estimatedCostUsd: cost,
      costLabel: `$${cost.toFixed(6)}`,
    };
  }
}

function estimateTokens(text) {
  return Math.round((text || "").length / 4);
}

function estimateCost(usage) {
  if (!usage) return 0;
  // Pricing is configurable via env (P8), never hardcoded in
  // application logic. Defaults reflect a Sonnet-class blended rate
  // for telemetry display purposes only; override for your actual
  // model/contract.
  const inputPricePerMillion = Number(process.env.LLM_INPUT_PRICE_PER_MILLION ?? 3);
  const outputPricePerMillion = Number(process.env.LLM_OUTPUT_PRICE_PER_MILLION ?? 15);
  const inCost = (usage.input_tokens || 0) * (inputPricePerMillion / 1_000_000);
  const outCost = (usage.output_tokens || 0) * (outputPricePerMillion / 1_000_000);
  return Number((inCost + outCost).toFixed(6));
}

// ============================================================
// GEMINI PROVIDER, Google's official @google/genai SDK. Offered
// specifically because it has a genuine no-credit-card free tier
// (unlike Anthropic's pay-as-you-go-only model), making it the
// easier "real LLM" option to actually try during local
// development.
// ============================================================
class GeminiProvider {
  constructor(apiKey, model = process.env.GEMINI_MODEL || "gemini-2.0-flash") {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
    this.name = model;
    this.providerType = "real";
    this.sourceLabel = "gemini";
  }

  async generate({ system, user }) {
    const start = Date.now();
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: user }] }],
      config: { systemInstruction: system, maxOutputTokens: 700 },
    });
    const latencyMs = Date.now() - start;
    const text = response.text ?? "";
    const usageMeta = response.usageMetadata;
    const usage = usageMeta ? { input_tokens: usageMeta.promptTokenCount, output_tokens: usageMeta.candidatesTokenCount } : null;
    const cost = estimateGeminiCost(usage);
    return {
      text,
      model: this.model,
      providerType: "real",
      isMock: false,
      narrativeSource: "gemini",
      inputTokens: usage?.input_tokens ?? estimateTokens(system + user),
      outputTokens: usage?.output_tokens ?? estimateTokens(text),
      tokensAreEstimated: !usage,
      latencyMs,
      estimatedCostUsd: cost,
      // Gemini's free tier (generous daily request quota on
      // gemini-2.0-flash at time of writing) is genuinely $0 for
      // typical demo/dev volume, labeled explicitly so telemetry
      // doesn't misleadingly show a nonzero "real API, real cost"
      // figure for calls that actually cost nothing.
      costLabel: cost === 0 ? "$0.00, Gemini free tier" : `$${cost.toFixed(6)}`,
    };
  }
}

function estimateGeminiCost(usage) {
  if (!usage) return 0;
  // Free by default, set these if you're on a paid Gemini tier/
  // model where usage is actually billed.
  const inputPricePerMillion = Number(process.env.GEMINI_INPUT_PRICE_PER_MILLION ?? 0);
  const outputPricePerMillion = Number(process.env.GEMINI_OUTPUT_PRICE_PER_MILLION ?? 0);
  const inCost = (usage.input_tokens || 0) * (inputPricePerMillion / 1_000_000);
  const outCost = (usage.output_tokens || 0) * (outputPricePerMillion / 1_000_000);
  return Number((inCost + outCost).toFixed(6));
}

// ------------------------------------------------------------------
// Fallback chain: Gemini -> Anthropic -> Mock. Every step is tried
// in order; any thrown error (missing key already filtered out
// below, but also quota/network/timeout/malformed-response errors)
// moves to the next step rather than surfacing to the user. The
// final result always carries an honest `narrativeSource` so the UI
// never claims a real model wrote text that a fallback produced.
// ------------------------------------------------------------------
function buildCandidateProviders() {
  const candidates = [];
  if (process.env.GEMINI_API_KEY) candidates.push(new GeminiProvider(process.env.GEMINI_API_KEY));
  if (process.env.ANTHROPIC_API_KEY) candidates.push(new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
  return candidates;
}

export async function generateWithFallback({ system, user, persona, personaView }) {
  const candidates = buildCandidateProviders();
  const attempts = [];
  for (const provider of candidates) {
    try {
      const result = await provider.generate({ system, user, persona, personaView });
      return { ...result, attempts };
    } catch (err) {
      attempts.push({ provider: provider.constructor.name, error: err.message });
    }
  }
  // Every real provider (if any were configured) failed, or none
  // were configured at all, deterministic fallback. Never throws.
  const mockResult = await new MockProvider().generate({ system, user, persona, personaView });
  const usedFallback = candidates.length > 0;
  return {
    ...mockResult,
    narrativeSource: usedFallback ? "mock-fallback" : "mock",
    fallbackReason: usedFallback ? attempts.map((a) => `${a.provider}: ${a.error}`).join(" | ") : null,
    attempts,
  };
}

export function getProvider() {
  // Kept for any direct callers that still want a single provider
  // object rather than the fallback chain (none currently do, see
  // narrativeEngine.js, which calls generateWithFallback directly).
  const candidates = buildCandidateProviders();
  return candidates[0] || new MockProvider();
}


// --------------------------------------------------------------
// Preferred mock narration path: constructs real prose directly
// from the structured personaView object (see personaEngine.js) ,
// no regex re-parsing of a flattened text prompt, which is what
// previously produced field-dump-looking output for the analyst
// persona (e.g. "Trend: current=989357 baseline=1140999..."). Real
// providers (Gemini/Anthropic) still receive the flat text prompt,
// since a real completion API genuinely needs one; only the mock
// gets the shortcut, since it already lives in this codebase.
// --------------------------------------------------------------
function fmtCurrency(v) {
  if (v == null) return "N/A";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function mockNarrateFromView(v, persona) {
  if (v.kind === "executive") return mockNarrateExecutiveFromView(v);
  if (v.kind === "operations") return mockNarrateOperationsFromView(v);
  if (v.kind === "analyst") return mockNarrateAnalystFromView(v);
  return mockNarrateExecutiveFromView(v);
}

function mockNarrateExecutiveFromView(v) {
  const decisionPhrase = {
    RECOMMEND_ACTION: "This warrants action.",
    INVESTIGATE_DEEPER: "This warrants further validation before acting.",
    AMBIGUOUS: "The root cause is not yet clear enough to act on.",
    NO_ACTION: "No action is needed. This is within normal range.",
    ABSTAIN: "There isn't yet enough evidence to recommend an action.",
    ABSTAIN_INSUFFICIENT_HISTORY: "There isn't yet enough history to draw a conclusion.",
  }[v.decisionRequired] || "";
  const confidenceText = v.confidence ? `${v.confidence.value}% (${v.confidence.level})` : "n/a";
  return [
    `${v.whatChanged}.`,
    v.why,
    `Confidence: ${confidenceText}.`,
    decisionPhrase,
    v.action,
    `Expected impact: ${v.impact}`,
    v.owner ? `Owner: ${v.owner}.` : "",
  ].filter(Boolean).join(" ");
}

function mockNarrateOperationsFromView(v) {
  return [
    `${v.operationalDriver || "No single driver identified"}, ${v.affectedRegion}.`,
    v.controllableLever ? `Lever: ${v.controllableLever}.` : "",
    v.immediateAction,
    v.owner ? `Owner: ${v.owner}.` : "",
    v.expectedImpact,
    v.monitoringPlan,
    v.nextBestInvestigation ? `Next: ${v.nextBestInvestigation}` : "",
  ].filter(Boolean).join(" ");
}

function mockNarrateAnalystFromView(v) {
  const t = v.kpiTrend;
  const topRanked = v.driverRanking.slice(0, 3).map((h) => `${h.label} (${h.confidence}%, ${h.tier})`).join(", ");
  const topEvidence = v.evidenceExplorer[0];
  const alts = v.alternativeHypotheses.slice(0, 2).map((h) => h.label).join(" and ");

  const sentences = [];
  sentences.push(`The KPI moved from a baseline of ${fmtCurrency(t.baseline)} to ${fmtCurrency(t.current)}, a ${t.changePct}% change (z-score ${t.zScore}, materiality ${t.materialityScore}/100 against an adaptive threshold of ${t.adaptiveThreshold}%).`);
  sentences.push(`The driver ranking places ${topRanked} as the leading candidates.`);
  if (topEvidence) {
    sentences.push(`The top hypothesis is supported by ${topEvidence.source} data. ${topEvidence.metric} moved ${topEvidence.change}, with ${topEvidence.alignment} temporal alignment to the KPI movement.`);
    if (topEvidence.supporting?.length) sentences.push(topEvidence.supporting.join(" "));
    if (topEvidence.contradicting?.length) sentences.push(`However, ${topEvidence.contradicting.join(" ")}`);
  }
  if (v.confidenceBreakdown) {
    const c = v.confidenceBreakdown.checks;
    sentences.push(`Confidence reflects cross-source agreement of ${c.crossSourceAgreement}, signal strength of ${c.signalStrength}, historical similarity of ${c.historicalSimilarity}, and data freshness of ${c.dataFreshness}.`);
  }
  if (alts) sentences.push(`${alts} remain alternative hypotheses with comparatively weaker evidence.`);
  if (v.lineage) sentences.push(`Lineage: ${v.lineage}.`);
  sentences.push(v.historicalMemory?.isNovel ? "No comparable historical scenario was found. This is a novel pattern." : `This pattern is ${v.historicalMemory?.best?.similarity ?? 0}% similar to a previously confirmed scenario.`);
  if (v.nextBestInvestigation) sentences.push(`Next best investigation: ${v.nextBestInvestigation.text}`);
  return sentences.join(" ");
}

// --------------------------------------------------------------
// Fallback mock narration when no personaView is available (kept
// for narrateSparse's legacy flat field set, see
// narrativeEngine.js's buildExecutivePrompt/buildOperationsPrompt/
// buildAnalystPrompt). This is what actually runs by default (no
// API key needed), it must demonstrate real persona
// differentiation on its own, not just when a real LLM is
// configured. Still a template, not real generation, but the
// templates themselves are structurally distinct per persona, not
// one shared sentence with a persona flag.
// --------------------------------------------------------------
function extractFields(user) {
  const fields = {};
  const lines = user.split("\n");
  let currentKey = null;
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      fields[currentKey] = m[2];
    } else if (currentKey && line.trim()) {
      fields[currentKey] += "\n" + line; // continuation line (e.g. DRIVER_RANKING's indented list)
    }
  }
  return fields;
}

function mockNarrate(user, personaHint) {
  const f = extractFields(user);
  const persona = f.PERSONA || personaHint || "executive";

  if (persona === "analyst") return mockNarrateAnalyst(f);
  if (persona === "operations") return mockNarrateOperations(f);
  return mockNarrateExecutive(f);
}

// EXECUTIVE, decision-first, compact, business framing.
function mockNarrateExecutive(f) {
  if (!f.WHAT_CHANGED) {
    // sparse-product path uses the legacy flat field set
    return mockNarrateLegacyFallback(f);
  }
  const decisionPhrase = { RECOMMEND_ACTION: "This warrants action.", INVESTIGATE_DEEPER: "This warrants further validation before acting.", AMBIGUOUS: "The root cause is not yet clear enough to act on.", NO_ACTION: "No action is needed. This is within normal range.", ABSTAIN: "There isn't yet enough evidence to recommend an action.", ABSTAIN_INSUFFICIENT_HISTORY: "There isn't yet enough history to draw a conclusion." }[f.DECISION] || "";
  return `${f.WHAT_CHANGED}. ${f.WHY} Confidence: ${f.CONFIDENCE}. ${decisionPhrase} ${f.ACTION} Expected impact: ${f.IMPACT}${f.OWNER !== "n/a" ? ` Owner: ${f.OWNER}.` : ""}`;
}

// OPERATIONS, terse, action-first, no business framing, no
// confidence philosophy, just what to do and who owns it.
function mockNarrateOperations(f) {
  if (f.DECISION === undefined && !f.OPERATIONAL_DRIVER) return mockNarrateLegacyFallback(f);
  const lines = [];
  lines.push(`${f.OPERATIONAL_DRIVER || "No single driver identified"}, ${f.AFFECTED_REGION}.`);
  if (f.CONTROLLABLE_LEVER && f.CONTROLLABLE_LEVER !== "n/a") lines.push(`Lever: ${f.CONTROLLABLE_LEVER}.`);
  lines.push(f.IMMEDIATE_ACTION);
  if (f.OWNER && f.OWNER !== "n/a") lines.push(`Owner: ${f.OWNER}.`);
  if (f.EXPECTED_IMPACT) lines.push(f.EXPECTED_IMPACT);
  if (f.MONITORING_PLAN && f.MONITORING_PLAN !== "n/a") lines.push(f.MONITORING_PLAN);
  if (f.NEXT_BEST_INVESTIGATION && f.NEXT_BEST_INVESTIGATION !== "n/a") lines.push(`Next: ${f.NEXT_BEST_INVESTIGATION}`);
  return lines.join(" ");
}

// ANALYST, dense, technical, uses the full ranking/evidence/
// alternative-hypothesis/lineage detail an executive or ops brief
// deliberately omits.
function mockNarrateAnalyst(f) {
  if (!f.KPI_TREND) return mockNarrateLegacyFallback(f);
  const rankingSummary = (f.DRIVER_RANKING || "").split("\n").filter((l) => l.trim().startsWith("-")).slice(0, 3).map((l) => l.trim()).join(" ");
  const altSummary = (f.ALTERNATIVE_HYPOTHESES || "").split("\n").filter((l) => l.trim().startsWith("-")).slice(0, 2).map((l) => l.trim()).join(" ");
  return [
    `Trend: ${f.KPI_TREND}.`,
    `Driver ranking: ${rankingSummary || "single candidate"}`,
    `Top evidence: ${f.TOP_EVIDENCE}.`,
    f.SUPPORTING && f.SUPPORTING !== "none" ? `Supporting: ${f.SUPPORTING}` : "",
    f.CONTRADICTING && f.CONTRADICTING !== "none" ? `Contradicting: ${f.CONTRADICTING}` : "",
    `Confidence breakdown: ${f.CONFIDENCE_BREAKDOWN}.`,
    altSummary ? `Alternative hypotheses considered and ranked lower: ${altSummary}` : "",
    f.LINEAGE && f.LINEAGE !== "n/a" ? `Lineage: ${f.LINEAGE}.` : "",
    `Historical memory: ${f.HISTORICAL_MEMORY}.`,
    f.NEXT_BEST_INVESTIGATION && f.NEXT_BEST_INVESTIGATION !== "n/a" ? `Next best investigation: ${f.NEXT_BEST_INVESTIGATION}` : "",
  ].filter(Boolean).join(" ");
}

// Fallback for the sparse-product path, which still uses the older
// flat field set (KPI/REGION/CHANGE_PCT/...) rather than a
// persona-shaped prompt, kept narrow on purpose, not the shared
// general-purpose template the old single mockNarrate() used to be.
function mockNarrateLegacyFallback(f) {
  const decision = f.DECISION;
  const kpi = f.KPI || "This KPI";
  const region = f.REGION || "the region";
  if (decision === "AMBIGUOUS") {
    return `${kpi} in ${region} moved ${f.CHANGE_PCT}%. Two or more hypotheses remain close in confidence, so the system is not isolating a single root cause. ${f.UNCERTAINTY || ""} Recommend collecting the evidence noted below before committing to an action.`;
  }
  if (decision === "ABSTAIN_INSUFFICIENT_HISTORY") {
    return `This is a newly launched product with only a short observation window. Standard anomaly detection isn't reliable yet, so we're using early-adoption trend and a peer-product benchmark instead. Treat any read here as directional, not confirmed.`;
  }
  if (decision === "NO_ACTION") {
    return `${kpi} in ${region} moved ${f.CHANGE_PCT}%, which is within normal expected volatility for this KPI. No investigation is warranted at this time.`;
  }
  return `${kpi} in ${region} moved ${f.CHANGE_PCT}%, primarily driven by ${f.TOP_DRIVER}. Confidence: ${f.CONFIDENCE}%.`;
}
