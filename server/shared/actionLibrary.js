// ============================================================
// ACTION LIBRARY
// A fixed catalog of controllable levers and actions, keyed by
// driver node id. The LLM is only allowed to explain/personalize
// entries from this library, it cannot invent new actions.
// ============================================================

export const ACTION_LIBRARY = {
  checkout: [
    {
      id: "act_checkout_gateway",
      driver: "Checkout Success Rate",
      lever: "Payment infrastructure",
      action: "Investigate payment gateway failures and route affected traffic to the backup gateway.",
      owner: "Regional Operations / Engineering",
      monitoring: "Conversion rate and payment failure rate for the next 7 days.",
    },
  ],
  fulfillment: [
    {
      id: "act_fulfillment_capacity",
      driver: "Fulfillment SLA",
      lever: "Warehouse capacity / carrier mix",
      action: "Reallocate volume from the constrained warehouse to nearest-capacity facility and add a temporary carrier lane.",
      owner: "Regional Operations / Logistics",
      monitoring: "SLA breach rate and average delivery days, daily.",
    },
  ],
  delivery: [
    {
      id: "act_delivery_carrier",
      driver: "Delivery Time",
      lever: "Carrier performance",
      action: "Escalate with underperforming carrier and shift priority shipments to backup carrier.",
      owner: "Logistics",
      monitoring: "Average delivery days by carrier, weekly.",
    },
  ],
  complaints: [
    {
      id: "act_complaints_triage",
      driver: "Complaints",
      lever: "Support triage & root-cause tagging",
      action: "Stand up a dedicated triage queue for the spiking complaint category and route to the owning team.",
      owner: "Customer Support",
      monitoring: "Complaint volume by category, daily.",
    },
  ],
  inventory: [
    {
      id: "act_inventory_restock",
      driver: "Inventory",
      lever: "Replenishment",
      action: "Expedite replenishment for SKUs with elevated stockout rate; adjust safety stock thresholds.",
      owner: "Supply Chain",
      monitoring: "Stockout rate by SKU, daily.",
    },
  ],
  discounts: [
    {
      id: "act_discount_review",
      driver: "Discounts",
      lever: "Pricing / promo policy",
      action: "Review active discount campaigns for margin impact and taper underperforming promotions.",
      owner: "Pricing / Revenue Management",
      monitoring: "Discount rate and ASP, weekly.",
    },
  ],
  traffic: [
    {
      id: "act_traffic_demand",
      driver: "Traffic",
      lever: "Demand generation / marketing spend",
      action: "Review recent changes to paid/organic acquisition channels and marketing spend pacing for the affected region.",
      owner: "Growth / Marketing",
      monitoring: "Daily sessions by channel and region.",
    },
  ],
  customers: [
    {
      id: "act_customers_reactivation",
      driver: "Active Customers",
      lever: "Retention / reactivation",
      action: "Launch a targeted reactivation campaign for recently lapsed customers in the affected region.",
      owner: "CRM / Lifecycle Marketing",
      monitoring: "Active customer count and reactivation rate, weekly.",
    },
  ],
  returns: [
    {
      id: "act_returns_quality",
      driver: "Returns / Cancellations",
      lever: "Product quality / fulfillment accuracy",
      action: "Audit the top return reasons for the affected region's recent orders and flag any SKU or fulfillment-accuracy pattern.",
      owner: "Quality / Supply Chain",
      monitoring: "Return rate by reason code, weekly.",
    },
  ],
  cx: [
    {
      id: "act_cx_recovery",
      driver: "Customer Sentiment",
      lever: "Proactive support outreach",
      action: "Prioritize proactive outreach and CSAT recovery for recently affected customers; review root-cause tags on negative tickets.",
      owner: "Customer Support / CX",
      monitoring: "Sentiment score and ticket volume, daily.",
    },
  ],
  monitor_only: [
    {
      id: "act_monitor",
      driver: "General",
      lever: "Monitoring",
      action: "No high-confidence lever identified yet. Continue monitoring the leading indicators and collect the evidence listed below.",
      owner: "Analytics",
      monitoring: "Re-evaluate once new evidence arrives.",
    },
  ],
};

export function getActionsForDriver(driverId) {
  return ACTION_LIBRARY[driverId] || ACTION_LIBRARY.monitor_only;
}

// P1#5, governed, NOT a real org-chart integration (disclosed
// plainly): a small per-region escalation-contact table that
// contextualizes the action library's generic functional owner
// with which region's team actually owns it. Still entirely static
// config, just one more dimension of it, exactly the kind of
// "governed decision-right configuration" the brief asked for
// instead of a fabricated real integration.
const REGIONAL_TEAM_PREFIX = {
  north: "North Regional",
  south: "South Regional",
  west: "West Regional",
  all: "Company-wide",
};

export function resolveOwner(baseOwner, region) {
  const prefix = REGIONAL_TEAM_PREFIX[region];
  if (!prefix || !baseOwner.startsWith("Regional")) return baseOwner; // only contextualize owners that are already region-scoped functions
  return baseOwner.replace("Regional", prefix);
}
