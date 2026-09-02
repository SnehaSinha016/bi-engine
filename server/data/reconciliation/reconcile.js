// ============================================================
// RECONCILIATION LAYER
// The only place in the app that knows ERP/CRM/Support use
// different region naming and that CRM/Support customer IDs need
// joining. Everything downstream (analytics/reasoning) consumes
// the canonical output of buildCanonicalModel() and has NO idea
// three heterogeneous sources ever existed, same contract as the
// old single-table generator, so the reasoning layer is untouched.
//
//   ERP ─────┐
//   CRM ─────┼→ reconcile.js → canonical erp[] / support[] rows
//   Support ─┘
// ============================================================

// Canonical region map: each source spells region differently.
//   ERP:     region_code  = "N" | "S" | "W"
//   CRM:     region_name  = "North" | "South" | "West"
//   Support: region_label = "north-region" | "south-region" | "west-region"
// All three collapse to the same lowercase canonical key used
// everywhere else in the app (RBAC scopes, the region picker, etc).
const REGION_ALIAS_MAP = {
  // ERP codes
  N: "north", S: "south", W: "west",
  // CRM names
  North: "north", South: "south", West: "west",
  // Support labels
  "north-region": "north", "south-region": "south", "west-region": "west",
};

export function canonicalizeRegion(raw) {
  return REGION_ALIAS_MAP[raw] || null;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// Reconciles Support ticket customer_id against the CRM customer
// roster. Returns per-ticket match status plus aggregate stats ,
// this is real record linkage (exact-match on a real join key that
// ~20% of tickets deliberately don't have), not a cosmetic label.
export function reconcileCustomers(crmCustomers, supportTickets) {
  const knownIds = new Set(crmCustomers.map((c) => c.customer_id));
  let matched = 0;
  let unmatched = 0;
  const unmatchedSample = [];
  const reconciledTickets = supportTickets.map((t) => {
    const isMatched = knownIds.has(t.customer_id);
    if (isMatched) matched++;
    else {
      unmatched++;
      if (unmatchedSample.length < 10) unmatchedSample.push(t.customer_id);
    }
    return { ...t, crm_matched: isMatched };
  });
  const total = matched + unmatched;
  return {
    reconciledTickets,
    matchedCount: matched,
    unmatchedCount: unmatched,
    matchRate: total ? Number(((matched / total) * 100).toFixed(1)) : 0,
    unmatchedSample,
    // exact-string-match join on a real key -> high confidence when
    // it hits, zero ambiguity (no fuzzy matching is attempted, so
    // there's no partial-confidence case to report here honestly)
    mappingConfidence: "high (exact customer_id match)",
  };
}

// Validates every raw region string actually mapped to a canonical
// region, surfaces any region string reconciliation couldn't
// resolve, rather than silently dropping records.
function canonicalizeRegionField(rawValue, sourceLabel, unresolvedLog) {
  const canonical = canonicalizeRegion(rawValue);
  if (!canonical) unresolvedLog.push({ source: sourceLabel, rawValue });
  return canonical;
}

// Builds the exact erp[] row shape analytics/engine.js already
// expects, by aggregating the three heterogeneous raw sources per
// canonical region+date. This is the seam that keeps the rest of
// the app (materiality, driver trees, hypotheses, confidence)
// completely unaware three different schemas were ever involved.
export function buildCanonicalModel({ erpOrders, erpOps, crmDaily, supportTickets: rawSupportTickets, crmCustomers }) {
  const unresolvedRegions = [];

  const custRecon = reconcileCustomers(crmCustomers, rawSupportTickets);
  const supportTickets = custRecon.reconciledTickets.map((t) => ({
    ticketId: t.ticket_id,
    date: t.timestamp.slice(0, 10),
    region: canonicalizeRegionField(t.region_label, "support.region_label", unresolvedRegions),
    customerId: t.customer_id,
    category: t.category,
    issue: t.issue_text,
    sentiment: t.sentiment,
    freeText: t.issue_text,
    crmMatched: t.crm_matched,
  }));

  // --- ERP: aggregate order-line rows -> region/day ---
  const erpByKey = new Map();
  for (const o of erpOrders) {
    const region = canonicalizeRegionField(o.region_code, "erp.region_code", unresolvedRegions);
    const key = `${o.date}|${region}`;
    if (!erpByKey.has(key)) erpByKey.set(key, { date: o.date, region, orders: 0, revenue: 0, discount: 0, refund: 0 });
    const acc = erpByKey.get(key);
    acc.orders += 1;
    acc.revenue += o.revenue;
    acc.discount += o.discount;
    acc.refund += o.refund;
  }

  const opsByKey = new Map();
  for (const op of erpOps) {
    const region = canonicalizeRegionField(op.region_code, "erp.region_code", unresolvedRegions);
    opsByKey.set(`${op.date}|${region}`, op);
  }

  // --- CRM: region/day activity, already at the right grain ---
  const crmByKey = new Map();
  for (const c of crmDaily) {
    const region = canonicalizeRegionField(c.region_name, "crm.region_name", unresolvedRegions);
    crmByKey.set(`${c.date}|${region}`, c);
  }

  // --- Support: ticket count + avg sentiment -> region/day ---
  const supportByKey = new Map();
  for (const t of supportTickets) {
    const key = `${t.date}|${t.region}`;
    if (!supportByKey.has(key)) supportByKey.set(key, { count: 0, sentiments: [] });
    const acc = supportByKey.get(key);
    acc.count += 1;
    acc.sentiments.push(t.sentiment);
  }

  // --- Merge into the canonical erp[] shape (union of all keys) ---
  const allKeys = new Set([...erpByKey.keys(), ...crmByKey.keys()]);
  const erp = [...allKeys].sort().map((key) => {
    const [date, region] = key.split("|");
    const e = erpByKey.get(key) || { orders: 0, revenue: 0, discount: 0, refund: 0 };
    const ops = opsByKey.get(key) || {};
    const crm = crmByKey.get(key) || {};
    const sup = supportByKey.get(key);

    return {
      date,
      region,
      traffic: crm.traffic ?? 0,
      orders: e.orders,
      revenue: e.revenue,
      conversion: crm.conversion_rate ?? (crm.traffic ? e.orders / crm.traffic : 0),
      aov: e.orders ? e.revenue / e.orders : 0,
      discountRate: e.revenue ? e.discount / (e.revenue + e.discount) : 0,
      refundsRate: e.revenue ? e.refund / e.revenue : 0,
      checkoutSuccessRate: ops.checkout_success_rate ?? 0,
      stockoutRate: ops.stockout_rate ?? 0,
      deliveryDays: ops.delivery_days ?? 0,
      slaBreachRate: ops.sla_breach_rate ?? 0,
      activeCustomers: crm.active_customers ?? 0,
      churnRate: crm.churn_rate ?? 0,
      // Real ticket volume/sentiment is kept on the reconciled
      // support[] records for evidence lookups (supportEvidence());
      // the day-level complaintRate/sentimentScore KPI fields come
      // from the ERP ops snapshot, see erpRaw.js comment on why
      // deriving these from raw ticket counts would be too sparse
      // to be meaningful at realistic ticket volumes.
      sentimentScore: ops.sentiment_index ?? 0.5,
      complaintRate: ops.complaint_rate ?? 0,
      supportTicketCount: sup ? sup.count : 0,
      avgTicketSentiment: sup ? mean(sup.sentiments) : null,
      refundsRateRaw: e.refund,
    };
  });

  const regionMappingsUsed = Object.entries(REGION_ALIAS_MAP).map(([raw, canonical]) => ({ raw, canonical }));

  const report = {
    generatedAt: new Date().toISOString(),
    recordsProcessed: {
      erpOrders: erpOrders.length,
      erpOps: erpOps.length,
      crmCustomers: crmCustomers.length,
      crmDaily: crmDaily.length,
      supportTickets: rawSupportTickets.length,
    },
    regionReconciliation: {
      mappingsApplied: regionMappingsUsed,
      unresolved: unresolvedRegions,
      status: unresolvedRegions.length === 0 ? "all region strings resolved" : `${unresolvedRegions.length} unresolved region string(s)`,
    },
    customerReconciliation: {
      matchedCount: custRecon.matchedCount,
      unmatchedCount: custRecon.unmatchedCount,
      matchRate: custRecon.matchRate,
      mappingConfidence: custRecon.mappingConfidence,
      unmatchedSample: custRecon.unmatchedSample,
    },
  };

  return { erp, support: supportTickets, reconciliationReport: report };
}
