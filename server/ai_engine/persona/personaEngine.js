// ============================================================
// AI INTELLIGENCE ENGINE, PERSONA ENGINE
//
// Responsibility: define what each persona needs from an
// investigation and reshape the SAME verified analysis into a
// genuinely different structured view per persona, not the same
// object with fields hidden. The underlying facts (materiality,
// hypotheses, confidence, evidence, recommendation) never change
// between personas; what changes is which of them are surfaced,
// how much detail each carries, and how they're grouped.
//
// IMPORTANT: persona ids are deliberately NOT the same strings as
// RBAC roles (auth/users.js roles are "executive"/"manager"/
// "analyst" and control DATA ACCESS). Persona ids here are
// "executive"/"analyst"/"operations" and control PRESENTATION.
// Conflating the two was a real bug in an earlier version of this
// file (persona id "manager" collided with the RBAC role
// "manager"), see README/audit notes.
// ============================================================

export const PERSONAS = {
  executive: {
    id: "executive",
    label: "Executive View",
    role: "VP / business leader who needs to decide quickly",
    questions: ["What changed?", "Why?", "How confident are we?", "What should I do?", "What's the impact?"],
    narrativeLength: "short", // 3-5 sentences, decision-first
  },
  analyst: {
    id: "analyst",
    label: "Analyst View",
    role: "Business/data analyst validating the conclusion",
    questions: ["What's the full driver ranking?", "What's the evidence, per source?", "What are the alternative hypotheses?", "What's the lineage?"],
    narrativeLength: "detailed", // dense, technical, multi-paragraph
  },
  operations: {
    id: "operations",
    label: "Operations Manager View",
    role: "Regional operations owner who needs an immediate operational fix",
    questions: ["What's the operational driver?", "What lever do I control?", "What do I do right now?", "Who owns it?", "How do I monitor it?"],
    narrativeLength: "short", // operational, concrete, action-first
  },
};

export function getPersona(id) {
  return PERSONAS[id] || PERSONAS.executive;
}

export function listPersonas() {
  return Object.values(PERSONAS).map((p) => ({ id: p.id, label: p.label }));
}

// Resolves which persona view to use: an explicit request wins;
// otherwise falls back to a role-appropriate default. This is a
// DEFAULT, not a restriction, any authenticated user can switch to
// any persona view (persona is presentation, not access control;
// RBAC region-scoping is enforced separately and unaffected by
// persona choice, see auth/middleware.js regionGuard()).
export function resolvePersona(requestedPersona, userRole) {
  if (requestedPersona && PERSONAS[requestedPersona]) return requestedPersona;
  if (userRole === "executive") return "executive";
  if (userRole === "analyst") return "analyst";
  return "operations"; // regional managers default to the operational view
}

// ------------------------------------------------------------------
// buildPersonaView(insight, personaId), the core of genuine
// differentiation. Pure re-shaping of already-computed insight
// fields (never a new calculation) into a persona-specific
// structure. The frontend renders whichever shape came back;
// Executive/Operations get a compact object, Analyst gets a dense
// multi-section breakdown.
// ------------------------------------------------------------------
export function buildPersonaView(insight, personaId) {
  if (personaId === "analyst") return buildAnalystView(insight);
  if (personaId === "operations") return buildOperationsView(insight);
  return buildExecutiveView(insight);
}

function buildExecutiveView(insight) {
  const top = insight.topHypothesis;
  const action = insight.recommendation?.actions?.[0];
  return {
    kind: "executive",
    whatChanged: `${insight.kpiName} ${insight.change > 0 ? "+" : ""}${insight.change}% (${insight.region === "all" ? "all regions" : insight.region})`,
    why: top ? `${top.label} is the strongest supported driver.` : insight.decisionReason,
    confidence: top ? { value: top.confidence.overall, level: top.confidence.tier } : null,
    decisionRequired: insight.decision,
    action: action ? action.contextualRecommendation : (top?.confidence.tier === "MEDIUM" ? `Validate ${top.label} further before acting.` : insight.decisionReason),
    impact: action ? action.expectedImpact : (top?.impactEstimate?.available ? top.impactEstimate.text : "Impact estimate unavailable."),
    owner: action ? action.owner : null,
    monitoring: action ? action.monitoringPlan : null,
    trend: insight.trend, // real daily history, see investigationOrchestrator.js
  };
}

function buildOperationsView(insight) {
  const top = insight.topHypothesis;
  const action = insight.recommendation?.actions?.[0];
  return {
    kind: "operations",
    operationalDriver: top ? top.label : null,
    affectedRegion: insight.region === "all" ? "All regions" : insight.region,
    controllableLever: action ? action.lever : null,
    immediateAction: action ? action.action : (top ? `Investigate ${top.label}. Decision is currently "${insight.decision}", not yet confident enough to prescribe a fix.` : insight.decisionReason),
    owner: action ? action.owner : null,
    expectedImpact: action ? action.expectedImpact : (top?.impactEstimate?.available ? top.impactEstimate.text : "Impact estimate unavailable."),
    monitoringPlan: action ? action.monitoringPlan : null,
    nextBestInvestigation: insight.nextBestInvestigation?.text || null,
    trend: insight.trend, // real daily history, see investigationOrchestrator.js
  };
}

function buildAnalystView(insight) {
  const top = insight.topHypothesis;
  return {
    kind: "analyst",
    kpiTrend: {
      current: insight.currentValue,
      baseline: insight.baseline,
      changePct: insight.change,
      zScore: top?.primaryMetrics?.zScore ?? null,
      comparisonPeriod: "trailing baseline window (adaptive)",
      materialityScore: insight.materiality.materialityScore,
      adaptiveThreshold: insight.materiality.adaptiveThreshold,
      trend: insight.trend, // real daily history, see investigationOrchestrator.js
    },
    driverRanking: insight.hypotheses.map((h) => ({
      label: h.label,
      confidence: h.confidence.overall,
      tier: h.confidence.tier,
      causalTag: h.causalTag,
      contributionPct: h.contributionPct,
      evidenceStrength: h.evidenceStrength,
      deltaImpact: h.deltaImpact?.available ? h.deltaImpact.text : null,
    })),
    evidenceExplorer: insight.hypotheses.map((h) => ({
      label: h.label,
      source: h.structuredEvidence.source,
      metric: h.structuredEvidence.metric,
      change: h.structuredEvidence.change,
      timestamp: h.structuredEvidence.timestamp,
      alignment: h.structuredEvidence.alignment,
      supporting: h.supporting,
      contradicting: h.contradicting,
    })),
    analyticalMethod: insight.method,
    confidenceBreakdown: top ? { checks: top.confidence.checks, explanation: top.confidence.explanation, disclaimer: top.confidence.disclaimer } : null,
    alternativeHypotheses: insight.hypotheses.slice(1).map((h, i) => ({
      label: h.label,
      confidence: h.confidence.overall,
      whyRankedLower: top
        ? `${(top.confidence.overall - h.confidence.overall).toFixed(1)} confidence points below "${top.label}": ${h.confidence.explanation}`
        : h.confidence.explanation,
    })),
    lineage: top
      ? `${top.structuredEvidence.source} \u2192 ${top.node.metricKey} calculation \u2192 ${top.primaryMetrics.label} \u2192 evidence synthesis \u2192 "${top.label}" hypothesis`
      : null,
    historicalMemory: insight.historicalMemory,
    nextBestInvestigation: insight.nextBestInvestigation,
  };
}
