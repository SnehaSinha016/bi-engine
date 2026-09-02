import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { buildCanonicalModel } from "../reconciliation/reconcile.js";
import { REGIONS } from "../generate.js";

const CSV_DIR = path.join(process.cwd(), "data", "csv");

const NUMERIC_FIELDS = new Set([
  "revenue", "discount", "refund", // erp_orders
  "checkout_success_rate", "stockout_rate", "delivery_days", "sla_breach_rate", "inventory_on_hand_pct", "complaint_rate", "sentiment_index", // erp_ops
  "traffic", "conversion_rate", "churn_rate", "renewal_rate", "active_customers", // crm_daily
  "sentiment", // support_tickets
  "orders", // new_product
  "fp_revenue", "fp_conversion", "fp_complaints", "fp_delivery", "fp_traffic", // historical_scenarios
]);

function readCsv(file) {
  const full = path.join(CSV_DIR, file);
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  return rows.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = NUMERIC_FIELDS.has(k) && v !== "" ? Number(v) : v;
    }
    return out;
  });
}

function fileAge(file) {
  const full = path.join(CSV_DIR, file);
  if (!fs.existsSync(full)) return null;
  return Date.now() - fs.statSync(full).mtimeMs;
}

// ============================================================
// Loads the REAL heterogeneous CSV exports (erp_orders.csv,
// erp_ops.csv, crm_customers.csv, crm_daily.csv,
// support_tickets.csv, different schemas/grains/naming per file,
// same as the synthetic pipeline) and runs them through the exact
// same reconciliation layer as DATA_SOURCE=synthetic
// (reconciliation/reconcile.js buildCanonicalModel). This is what
// keeps CSV mode honestly consistent with the live/synthetic
// architecture instead of being a separate, pre-aggregated shortcut.
// ============================================================
export function loadCsvDataset() {
  const erpOrders = readCsv("erp_orders.csv") || [];
  const erpOps = readCsv("erp_ops.csv") || [];
  const crmCustomers = readCsv("crm_customers.csv") || [];
  const crmDaily = readCsv("crm_daily.csv") || [];
  const supportTickets = readCsv("support_tickets.csv") || [];
  const histRows = readCsv("historical_scenarios.csv") || [];
  const newProductRows = readCsv("new_product.csv") || [];

  if (!erpOrders.length) {
    throw new Error(
      "No CSV data found at server/data/csv/erp_orders.csv. Regenerate exports (see README §Data sources) or set DATA_SOURCE=synthetic."
    );
  }

  const { erp, support, reconciliationReport } = buildCanonicalModel({
    erpOrders, erpOps, crmDaily, supportTickets, crmCustomers,
  });

  const regions = [...new Set(erp.map((r) => r.region))];

  const historicalScenarios = histRows.map((h) => ({
    id: h.id,
    title: h.title,
    date: h.date,
    region: h.region,
    fingerprint: {
      revenue: h.fp_revenue,
      conversion: h.fp_conversion,
      complaints: h.fp_complaints,
      delivery: h.fp_delivery,
      traffic: h.fp_traffic,
    },
    suspectedDriver: h.suspectedDriver,
    whatHappened: h.whatHappened,
    actionTaken: h.actionTaken,
    outcome: h.outcome,
    actionWorked: String(h.actionWorked) === "true",
  }));

  const newProduct = newProductRows.length
    ? {
        product: newProductRows[0].product,
        region: newProductRows[0].region,
        launchDate: newProductRows[0].date,
        days: newProductRows.map((r) => ({ date: r.date, region: r.region, product: r.product, orders: r.orders, revenue: r.revenue })),
      }
    : null;

  const now = Date.now();
  const ageMs = (file) => fileAge(file) ?? 0;
  const sourceMeta = {
    ERP: { lastUpdatedMs: now - Math.min(ageMs("erp_orders.csv"), ageMs("erp_ops.csv")), cadence: "file (erp_orders.csv / erp_ops.csv)" },
    CRM: { lastUpdatedMs: now - Math.min(ageMs("crm_customers.csv"), ageMs("crm_daily.csv")), cadence: "file (crm_customers.csv / crm_daily.csv)" },
    Support: { lastUpdatedMs: now - ageMs("support_tickets.csv"), cadence: "file (support_tickets.csv)" },
  };

  return {
    regions: regions.length ? regions : REGIONS,
    products: [],
    segments: [],
    erp,
    support,
    historicalScenarios,
    newProduct,
    sourceMeta,
    reconciliationReport,
    rawSourceCounts: {
      erpOrders: erpOrders.length,
      erpOps: erpOps.length,
      crmCustomers: crmCustomers.length,
      crmDaily: crmDaily.length,
      supportTickets: supportTickets.length,
    },
  };
}
