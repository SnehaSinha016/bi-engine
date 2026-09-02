// ============================================================
// KPI SEMANTIC CONTRACTS
// Lightweight, machine-readable definitions of what each KPI
// means, how it's computed, and who can see it.
// These are DATA, not LLM output, the LLM never invents a
// formula, a threshold, or a business weight. It only reads these.
//
// `materialityFloor` is NOT the materiality threshold anymore
// (P1: adaptive materiality). It's a minimum-move floor so a
// near-zero-volatility metric can't be flagged material over a
// trivial move, the real threshold is computed per-region,
// per-metric from that metric's own trailing volatility. See
// analytics/engine.js `computeAdaptiveThreshold`.
//
// `businessWeight` (1-5) is a static, human-set business-priority
// input, the "priority" component the brief asks materiality to
// combine alongside statistical deviation. This is a policy
// decision, not something derivable from data, so it stays
// explicit config rather than "adaptive".
// ============================================================

export const KPI_CONTRACTS = {
  revenue: {
    id: "revenue",
    name: "Revenue",
    definition: "Net recognized sales revenue",
    formula: "gross_sales - discounts - refunds",
    grain: "daily",
    dimensions: ["region", "product", "customer_segment"],
    sources: ["ERP", "CRM"],
    refreshCadence: "hourly",
    materialityFloor: 3,
    businessWeight: 5,
    drivers: ["volume", "price", "operational"],
    accessRestrictions: ["executive", "manager", "analyst"],
    unit: "currency",
  },
  orders: {
    id: "orders",
    name: "Orders",
    definition: "Count of confirmed, non-cancelled orders",
    formula: "count(orders where status != 'cancelled')",
    grain: "daily",
    dimensions: ["region", "product", "customer_segment"],
    sources: ["ERP"],
    refreshCadence: "hourly",
    materialityFloor: 4,
    businessWeight: 4,
    drivers: ["volume"],
    accessRestrictions: ["executive", "manager", "analyst"],
    unit: "count",
  },
  conversion: {
    id: "conversion",
    name: "Conversion Rate",
    definition: "Orders divided by unique sessions/traffic",
    formula: "orders / traffic_sessions",
    grain: "daily",
    dimensions: ["region", "channel"],
    sources: ["ERP", "CRM"],
    refreshCadence: "hourly",
    materialityFloor: 3,
    businessWeight: 4,
    drivers: ["operational"],
    accessRestrictions: ["executive", "manager", "analyst"],
    unit: "percent",
  },
  aov: {
    id: "aov",
    name: "Average Order Value",
    definition: "Net revenue divided by order count",
    formula: "revenue / orders",
    grain: "daily",
    dimensions: ["region", "product"],
    sources: ["ERP"],
    refreshCadence: "hourly",
    materialityFloor: 3,
    businessWeight: 3,
    drivers: ["price"],
    accessRestrictions: ["executive", "manager", "analyst"],
    unit: "currency",
  },
  churn: {
    id: "churn",
    name: "Customer Churn",
    definition: "Share of active customers lost in the period",
    formula: "lost_customers / active_customers_start_of_period",
    grain: "weekly",
    dimensions: ["region", "customer_segment"],
    sources: ["CRM", "Support"],
    refreshCadence: "daily",
    materialityFloor: 2,
    businessWeight: 4,
    drivers: ["operational"],
    accessRestrictions: ["executive", "manager", "analyst"],
    unit: "percent",
  },
};

export function getContract(kpiId) {
  const c = KPI_CONTRACTS[kpiId];
  if (!c) throw new Error(`Unknown KPI contract: ${kpiId}`);
  return c;
}

