// ============================================================
// AI INTELLIGENCE ENGINE, EVIDENCE ENGINE
//
// Responsibility: combine structured analytics (anomaly/trend/
// contribution, already computed by the Analytics Engine) with
// qualitative evidence (support tickets) and historical-memory
// signals into a per-hypothesis supporting/contradicting evidence
// bundle. Every hypothesis that reaches the Confidence Engine
// carries: what supports it, what contradicts it, which data
// sources it drew on, and how that evidence strength was scored ,
// nothing here is asserted without a traceable number behind it.
// ============================================================

import { supportEvidence, round } from "../../analytics/engine.js";

// Ticket volume + sentiment -> a bounded 0-100 evidence-strength
// score. Deliberately capped (70 + 30) so a single noisy day of
// tickets can't alone push a hypothesis to maximum evidence
// strength, evidence strength should still need corroborating
// anomaly/contribution signal to dominate a ranking.
export function evidenceStrengthFromTickets(ev) {
  const countScore = Math.min(ev.ticketCount * 12, 70);
  const sentimentScore = Math.min(Math.abs(Math.min(ev.avgSentiment, 0)) * 60, 30);
  return round(countScore + sentimentScore, 1);
}

// Gathers qualitative evidence (support tickets) for one hypothesis
// node from the Support source. If the node has no obvious ticket
// category, evidence strength instead derives from anomaly
// magnitude alone (handled by the caller) rather than fabricating
// ticket relevance that doesn't exist.
export function gatherEvidence(dataset, region, node) {
  const categories = node.evidenceCategories?.length ? node.evidenceCategories : null;
  const ev = supportEvidence(dataset, region, categories);
  return { categories, evidence: ev };
}

// Maps a metricKey to which upstream source system it comes from ,
// used only for the structured-evidence display (Part 1: "source:
// CRM / ERP / Support"), not for any calculation.
const SOURCE_BY_METRIC = {
  revenue: "ERP", orders: "ERP", aov: "ERP", discountRate: "ERP", returnRate: "ERP",
  stockoutRate: "ERP", avgDeliveryDays: "ERP", slaBreachRate: "ERP", checkoutSuccessRate: "ERP",
  traffic: "CRM", conversion: "CRM", activeCustomers: "CRM", churnRate: "CRM",
  complaintRate: "Support", sentimentScore: "Support",
};

function alignmentFor(zScore) {
  const abs = Math.abs(zScore);
  if (abs >= 3) return "high";
  if (abs >= 1.5) return "medium"; // same significance threshold materialityCheck() uses
  return "low";
}

// Structured evidence record, Part 1's required shape:
// { source, metric, change, alignment, timestamp }. One record per
// hypothesis's primary metric, built entirely from numbers already
// computed upstream (no new measurement here).
export function buildStructuredEvidence(hyp) {
  const m = hyp.primaryMetrics;
  const timestamp = m.dates?.length ? m.dates[m.dates.length - 1] : null;
  return {
    source: SOURCE_BY_METRIC[m.metricKey] || "ERP",
    metric: m.metricKey,
    change: `${m.pctChange > 0 ? "+" : ""}${m.pctChange}${m.composite ? " idx" : "%"}`,
    alignment: alignmentFor(m.zScore),
    timestamp,
  };
}

// Synthesizes the final supporting/contradicting evidence lines for
// one scored hypothesis, the human-readable evidence bundle
// attached to every hypothesis in an Intelligence Trace.
export function synthesizeEvidence(hyp) {
  const supporting = [];
  const contradicting = [];
  if (hyp.primaryMetrics.isAdverse) {
    const unitSuffix = hyp.primaryMetrics.composite ? " index points" : "%";
    supporting.push(
      `${hyp.primaryMetrics.label} moved ${hyp.primaryMetrics.pctChange}${unitSuffix} vs. baseline (z=${hyp.primaryMetrics.zScore}).`
    );
  } else {
    contradicting.push(`${hyp.primaryMetrics.label} did not move adversely (${hyp.primaryMetrics.pctChange}%).`);
  }
  if (hyp.evidence.ticketCount > 0) {
    supporting.push(`${hyp.evidence.ticketCount} support tickets in this region reference related issues (avg sentiment ${hyp.evidence.avgSentiment}).`);
  } else if (hyp.supportCategories?.length) {
    contradicting.push(`No related support tickets found in this region.`);
  }
  if (hyp.historicalSimilarity >= 65) {
    supporting.push(`Historical similarity ${hyp.historicalSimilarity}% to a past scenario with the same suspected/confirmed driver.`);
  }
  if (hyp.contradictionCount > 0) {
    contradicting.push(`Traffic also moved materially, which is not fully explained by this hypothesis alone.`);
  }
  return { supporting, contradicting };
}
