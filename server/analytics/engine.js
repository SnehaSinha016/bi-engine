// ============================================================
// ANALYTICS ENGINE, 100% deterministic. No LLM calls happen
// here. This is the "source of truth" layer: materiality,
// trend, anomaly, contribution, confidence, and historical
// scenario similarity are all plain arithmetic over the
// ERP/CRM/Support datasets (synthetic, CSV, or live).
// ============================================================

// Removed "leads" (= traffic * 0.35, a fabricated proxy with no
// real backing field) and "promoShare" (= discountRate * 0.6, a
// scaled duplicate of an existing field), see driverTrees.js
// header comment and README P6 notes. Every entry below maps to a
// genuinely distinct real field.
export const METRIC_FIELD_MAP = {
  revenue: { field: "revenue", direction: "higherIsGood", label: "Revenue", unit: "currency" },
  orders: { field: "orders", direction: "higherIsGood", label: "Orders", unit: "count" },
  traffic: { field: "traffic", direction: "higherIsGood", label: "Traffic", unit: "count" },
  conversion: { field: "conversion", direction: "higherIsGood", label: "Conversion Rate", unit: "percent" },
  checkoutSuccessRate: { field: "checkoutSuccessRate", direction: "higherIsGood", label: "Checkout Success Rate", unit: "percent" },
  activeCustomers: { field: "activeCustomers", direction: "higherIsGood", label: "Active Customers", unit: "count" },
  returnRate: { field: "refundsRate", direction: "higherIsBad", label: "Returns / Cancellations", unit: "percent" },
  aov: { field: "aov", direction: "higherIsGood", label: "Average Order Value", unit: "currency" },
  discountRate: { field: "discountRate", direction: "higherIsBad", label: "Discounts", unit: "percent" },
  stockoutRate: { field: "stockoutRate", direction: "higherIsBad", label: "Inventory Stockouts", unit: "percent" },
  avgDeliveryDays: { field: "deliveryDays", direction: "higherIsBad", label: "Delivery Time", unit: "days" },
  slaBreachRate: { field: "slaBreachRate", direction: "higherIsBad", label: "Fulfillment SLA Breaches", unit: "percent" },
  complaintRate: { field: "complaintRate", direction: "higherIsBad", label: "Complaints", unit: "percent" },
  sentimentScore: { field: "sentimentScore", direction: "higherIsGood", label: "Customer Sentiment", unit: "index" },
  churnRate: { field: "churnRate", direction: "higherIsBad", label: "Customer Churn", unit: "percent" },
};

export function getRegionRows(dataset, region) {
  return dataset.erp.filter((r) => r.region === region).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Company-wide (executive) view: aggregate all regions per date.
// Additive fields sum; rate fields are recomputed from the summed
// components or weighted-averaged, never simple-averaged blindly.
export function getAggregatedRows(dataset) {
  const byDate = {};
  for (const r of dataset.erp) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  }
  const dates = Object.keys(byDate).sort();
  return dates.map((date) => {
    const rows = byDate[date];
    const traffic = rows.reduce((s, r) => s + r.traffic, 0);
    const orders = rows.reduce((s, r) => s + r.orders, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const activeCustomers = rows.reduce((s, r) => s + r.activeCustomers, 0);
    const wavg = (field, weightField) => {
      const totalWeight = rows.reduce((s, r) => s + r[weightField], 0) || 1;
      return rows.reduce((s, r) => s + r[field] * r[weightField], 0) / totalWeight;
    };
    return {
      date,
      region: "all",
      traffic,
      orders,
      revenue,
      activeCustomers,
      conversion: traffic ? orders / traffic : 0,
      aov: orders ? revenue / orders : 0,
      deliveryDays: wavg("deliveryDays", "orders"),
      slaBreachRate: wavg("slaBreachRate", "orders"),
      complaintRate: wavg("complaintRate", "orders"),
      checkoutSuccessRate: wavg("checkoutSuccessRate", "traffic"),
      stockoutRate: mean(rows.map((r) => r.stockoutRate)),
      discountRate: mean(rows.map((r) => r.discountRate)),
      sentimentScore: mean(rows.map((r) => r.sentimentScore)),
      churnRate: wavg("churnRate", "activeCustomers"),
      refundsRate: mean(rows.map((r) => r.refundsRate)),
    };
  });
}

export function getSeries(dataset, region, metricKey) {
  const meta = METRIC_FIELD_MAP[metricKey] || { field: metricKey, direction: "higherIsGood", label: metricKey, unit: "" };
  const rows = region === "all" ? getAggregatedRows(dataset) : getRegionRows(dataset, region);
  const values = rows.map((r) => (r[meta.field] ?? 0) * (meta.scale ?? 1));
  const dates = rows.map((r) => r.date);
  return { values, dates, meta };
}

export function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}

export function stddev(arr, m) {
  const mu = m ?? mean(arr);
  const variance = mean(arr.map((v) => (v - mu) ** 2));
  return Math.sqrt(variance);
}

export function baselineStats(values) {
  // last element is "today"; everything before is baseline history
  const history = values.slice(0, -1);
  const mu = mean(history);
  const sigma = stddev(history, mu) || Math.max(Math.abs(mu) * 0.01, 1e-6);
  return { mean: mu, std: sigma, historyLength: history.length };
}

export function linregSlope(values) {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(values);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function trendLabel(slope, mu) {
  const normalized = mu !== 0 ? slope / Math.abs(mu) : 0;
  if (normalized > 0.003) return "improving";
  if (normalized < -0.003) return "declining";
  return "flat";
}

// Minimum baseline days required before we trust a z-score/adaptive
// threshold at all. Below this, "materiality" from statistics is
// not meaningful, same principle as the sparse-history handling
// for new products, generalized to every metric.
export const MIN_BASELINE_DAYS = 10;

// ------------------------------------------------------------------
// Core stats computation over an arbitrary (values, dates, meta)
// series. Both a real dataset-backed metric (computeNodeMetrics)
// and a synthetic composite series (computeCompositeMetrics, for
// branch nodes with no single real field) funnel through this same
// function, so materiality/anomaly/trend math is identical either
// way, never two parallel implementations to keep in sync.
// ------------------------------------------------------------------
function computeMetricsFromSeries(metricKey, values, dates, meta) {
  const today = values[values.length - 1];
  const { mean: baseMean, std, historyLength } = baselineStats(values);
  const insufficientHistory = historyLength < MIN_BASELINE_DAYS;

  const pctChange = baseMean !== 0 ? (today - baseMean) / baseMean : 0;
  const zScore = std !== 0 ? (today - baseMean) / std : 0;
  const slope = linregSlope(values.slice(0, -1));
  const trend = trendLabel(slope, baseMean);
  const volatility = baseMean !== 0 ? std / Math.abs(baseMean) : 0;

  const isAdverse = meta.direction === "higherIsGood" ? pctChange < 0 : pctChange > 0;
  const anomalyScore = clamp(Math.abs(zScore) * 22 + Math.abs(pctChange) * 100 * 1.6, 0, 100);

  return {
    metricKey,
    label: meta.label,
    unit: meta.unit || "",
    currentValue: round(today, 4),
    historicalBaseline: round(baseMean, 4),
    pctChange: round(pctChange * 100, 2), // as percent
    zScore: round(zScore, 2),
    trend,
    volatility: round(volatility * 100, 2), // coefficient of variation, as percent
    anomalyScore: round(anomalyScore, 1),
    isAdverse,
    historyLength,
    insufficientHistory,
    series: values,
    dates,
  };
}

// ------------------------------------------------------------------
// Full node-level intelligence for a real, dataset-backed metric.
// ------------------------------------------------------------------
export function computeNodeMetrics(dataset, region, metricKey) {
  const { values, dates, meta } = getSeries(dataset, region, metricKey);
  return { ...computeMetricsFromSeries(metricKey, values, dates, meta), region };
}

// ------------------------------------------------------------------
// Composite metric for a branch node with no single real field
// (currently just "Operational / Customer Context"). Built
// transparently from its children's own baselines: each child's
// daily value is standardized against ITS OWN baseline mean/std
// (sign-flipped so higher = worse), then averaged across children
// per day. The result is a genuine "operational stress index" ,
// documented, deterministic, reproducible, not a fabricated field
// and not silently zero the way an unmapped metricKey used to be.
// ------------------------------------------------------------------
export function computeCompositeMetrics(dataset, region, node) {
  const childKeys = (node.children || []).map((c) => c.metricKey);
  if (!childKeys.length) {
    throw new Error(`Composite node "${node.id}" has no children to derive a composite from`);
  }
  const childSeries = childKeys.map((mk) => {
    const { values, dates, meta } = getSeries(dataset, region, mk);
    const { mean: mu, std } = baselineStats(values);
    const sign = meta.direction === "higherIsBad" ? 1 : -1;
    return { dates, standardized: values.map((v) => (sign * (v - mu)) / (std || 1)) };
  });
  const dates = childSeries[0].dates;
  const composite = dates.map((_, i) => mean(childSeries.map((cs) => cs.standardized[i])));

  const meta = { direction: "higherIsBad", label: node.label, unit: "stress index" };
  const core = computeMetricsFromSeries(node.metricKey, composite, dates, meta);
  // A composite's "pctChange" (relative to a baseline that's ~0 by
  // construction) isn't a meaningful percent, report the absolute
  // index-point shift instead, clearly labeled, rather than a
  // misleading "%" on a value that was never a percentage.
  const { mean: baseMean } = baselineStats(composite);
  const todayIdx = composite[composite.length - 1];
  return {
    ...core,
    region,
    composite: true,
    indexPointChange: round(todayIdx - baseMean, 2),
    pctChange: round(todayIdx - baseMean, 2), // kept for UI compatibility; treat as index points, not %
  };
}

// Dispatches to the real-field or composite path depending on the
// tree node definition, callers don't need to know which.
export function computeMetricsForNode(dataset, region, node) {
  return node.composite ? computeCompositeMetrics(dataset, region, node) : computeNodeMetrics(dataset, region, node.metricKey);
}

// ------------------------------------------------------------------
// P1, ADAPTIVE MATERIALITY
// Replaces a single hardcoded percentage threshold with a
// per-metric, per-region threshold derived from that metric's own
// trailing volatility (coefficient of variation over the baseline
// window). A naturally noisy metric needs a bigger move to count as
// material; a naturally stable one is flagged on a smaller move ,
// directly implementing the brief's own example ("Revenue -8% is
// highly material if expected volatility is +-2%, less so if +-10%").
//
// `materialityFloor` on the KPI contract is a minimum floor only
// (guards against a near-zero-volatility metric flagging a trivial
// move), never the operative threshold on its own.
// ------------------------------------------------------------------
const ADAPTIVE_MULTIPLIER = Number(process.env.MATERIALITY_ADAPTIVE_MULTIPLIER || 1.6);

export function computeAdaptiveThreshold(nodeMetrics, contract) {
  const floor = contract?.materialityFloor ?? 2;
  const volatilityDerived = nodeMetrics.volatility * ADAPTIVE_MULTIPLIER;
  return round(Math.max(floor, volatilityDerived), 2);
}

export function materialityCheck(kpiId, contract, nodeMetrics) {
  if (nodeMetrics.insufficientHistory) {
    return {
      isMaterial: false,
      level: "UNKNOWN",
      threshold: null,
      adaptiveThreshold: null,
      pctChange: nodeMetrics.pctChange,
      zScore: nodeMetrics.zScore,
      statisticallySignificant: false,
      materialityScore: null,
      scoreComponents: null,
      insufficientHistory: true,
      rationale: `Only ${nodeMetrics.historyLength} days of baseline history (need ${MIN_BASELINE_DAYS}+), materiality cannot be reliably assessed yet.`,
    };
  }

  const threshold = computeAdaptiveThreshold(nodeMetrics, contract);
  const pctAbs = Math.abs(nodeMetrics.pctChange);
  const statSig = Math.abs(nodeMetrics.zScore) >= 1.5;
  const businessWeight = contract?.businessWeight ?? 3; // 1-5, static business-priority input

  // Explainable 0-100 Materiality Score combining statistical
  // deviation, magnitude vs. this metric's own adaptive baseline,
  // and business priority, not a single pass/fail percentage check.
  const statSigScore = clamp((Math.abs(nodeMetrics.zScore) / 3) * 100, 0, 100);
  const deviationScore = clamp((pctAbs / (threshold || 1)) * 50, 0, 100);
  const impactScore = (businessWeight / 5) * 100;
  const materialityScore = round(statSigScore * 0.4 + deviationScore * 0.4 + impactScore * 0.2, 1);

  const isMaterial = pctAbs >= threshold && statSig;
  let level = "LOW";
  if (isMaterial && pctAbs >= threshold * 1.6) level = "HIGH";
  else if (isMaterial) level = "MEDIUM";

  return {
    isMaterial,
    level,
    threshold,
    adaptiveThreshold: threshold,
    volatility: nodeMetrics.volatility,
    pctChange: nodeMetrics.pctChange,
    zScore: nodeMetrics.zScore,
    statisticallySignificant: statSig,
    materialityScore,
    scoreComponents: {
      statisticalDeviation: round(statSigScore, 1),
      deviationVsAdaptiveBaseline: round(deviationScore, 1),
      businessImpact: round(impactScore, 1),
      businessWeight,
    },
    insufficientHistory: false,
    rationale: isMaterial
      ? `${pctAbs.toFixed(1)}% move exceeds this metric's own adaptive threshold of ${threshold}% (baseline volatility ${nodeMetrics.volatility}%) and is statistically significant (z=${nodeMetrics.zScore}). Materiality score ${materialityScore}/100.`
      : `${pctAbs.toFixed(1)}% move is within this metric's own adaptive threshold of ${threshold}% (baseline volatility ${nodeMetrics.volatility}%${statSig ? "" : `, z=${nodeMetrics.zScore} not significant`}). Materiality score ${materialityScore}/100.`,
  };
}

// contribution of each child node to a parent's absolute move,
// normalized so contributions sum to ~100%.
export function computeContributions(childMetricsList) {
  const total = childMetricsList.reduce((s, c) => s + Math.abs(c.pctChange), 0) || 1;
  return childMetricsList.map((c) => ({
    metricKey: c.metricKey,
    label: c.label,
    contributionPct: round((Math.abs(c.pctChange) / total) * 100, 1),
  }));
}

export function dataQualityScore(dataset, sourceNames) {
  const now = Date.now();
  const cadenceMs = { hourly: 60 * 60 * 1000, daily: 24 * 60 * 60 * 1000, "near real-time": 5 * 60 * 1000 };
  let minScore = 100;
  const details = [];
  for (const src of sourceNames) {
    const meta = dataset.sourceMeta[src];
    if (!meta) continue;
    const ageMs = now - meta.lastUpdatedMs;
    const expected = cadenceMs[meta.cadence] || 60 * 60 * 1000;
    const staleness = clamp(ageMs / (expected * 2), 0, 1); // 0 = fresh, 1 = very stale
    const score = round(100 - staleness * 40, 1); // freshness alone won't tank quality below 60
    details.push({ source: src, ageMinutes: Math.round(ageMs / 60000), cadence: meta.cadence, score });
    minScore = Math.min(minScore, score);
  }
  return { overall: round(minScore, 1), details };
}

// ------------------------------------------------------------------
// Support-ticket evidence extraction for a region + category
// ------------------------------------------------------------------
export function supportEvidence(dataset, region, categories) {
  const tickets = dataset.support.filter(
    (t) => (region === "all" || t.region === region) && (!categories || categories.includes(t.category))
  );
  const avgSentiment = tickets.length ? round(mean(tickets.map((t) => t.sentiment)), 2) : 0;
  return {
    ticketCount: tickets.length,
    avgSentiment,
    sample: tickets.slice(0, 5).map((t) => ({ ticketId: t.ticketId, issue: t.issue, sentiment: t.sentiment, date: t.date })),
  };
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
export function round(v, d) {
  const m = 10 ** d;
  return Math.round(v * m) / m;
}
