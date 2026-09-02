// ============================================================
// INGESTION VALIDATION
//
// One validator per canonical table, matching the EXACT column
// schemas the existing CSV provider already reads (see
// data/csv/*.csv headers), so a validated, normalized record is
// immediately compatible with buildCanonicalModel(), with zero
// changes needed to the reconciliation or analytics layers.
// ============================================================

import { canonicalizeRegion } from "../reconciliation/reconcile.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z?$/;

function isNum(v) {
  return typeof v === "number" ? Number.isFinite(v) : v !== "" && v != null && Number.isFinite(Number(v));
}
function num(v) {
  return typeof v === "number" ? v : Number(v);
}

// Accepts any of the three real region spellings (region_code "N",
// region_name "North", region_label "north-region") OR the already-
// canonical lowercase form, and normalizes to whichever raw form the
// target table actually stores (matching the real CSV schema), while
// also returning the canonical key for duplicate-detection.
function resolveRegionField(raw, fieldKind) {
  if (raw == null || raw === "") return { ok: false, error: `${fieldKind} is required` };
  const canonical = canonicalizeRegion(raw) || canonicalizeRegion(String(raw).trim());
  if (!canonical) return { ok: false, error: `Unrecognized region value "${raw}". Use N/S/W, North/South/West, or north-region/south-region/west-region` };
  const REVERSE = {
    region_code: { north: "N", south: "S", west: "W" },
    region_name: { north: "North", south: "South", west: "West" },
    region_label: { north: "north-region", south: "south-region", west: "west-region" },
  };
  return { ok: true, value: REVERSE[fieldKind][canonical], canonical };
}

const VALIDATORS = {
  erp_orders(row) {
    const errors = [];
    if (!row.order_id) errors.push("order_id is required");
    if (!row.product_id) errors.push("product_id is required");
    const region = resolveRegionField(row.region_code, "region_code");
    if (!region.ok) errors.push(region.error);
    if (!DATE_RE.test(row.date)) errors.push("date must be YYYY-MM-DD");
    if (!isNum(row.revenue) || num(row.revenue) < 0) errors.push("revenue must be a non-negative number");
    if (row.discount != null && row.discount !== "" && (!isNum(row.discount) || num(row.discount) < 0)) errors.push("discount must be a non-negative number");
    if (row.refund != null && row.refund !== "" && (!isNum(row.refund) || num(row.refund) < 0)) errors.push("refund must be a non-negative number");
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      row: {
        order_id: String(row.order_id),
        product_id: String(row.product_id),
        region_code: region.value,
        date: row.date,
        revenue: num(row.revenue),
        discount: row.discount ? num(row.discount) : 0,
        refund: row.refund ? num(row.refund) : 0,
      },
      naturalKey: `order_id:${row.order_id}`,
    };
  },

  erp_ops(row) {
    const errors = [];
    const region = resolveRegionField(row.region_code, "region_code");
    if (!region.ok) errors.push(region.error);
    if (!DATE_RE.test(row.date)) errors.push("date must be YYYY-MM-DD");
    const pctFields = ["checkout_success_rate", "stockout_rate", "sla_breach_rate", "inventory_on_hand_pct", "complaint_rate"];
    for (const f of pctFields) {
      if (row[f] != null && row[f] !== "" && (!isNum(row[f]) || num(row[f]) < 0 || num(row[f]) > 1)) {
        errors.push(`${f} must be a fraction between 0 and 1 (e.g. 0.95 for 95%)`);
      }
    }
    if (row.delivery_days != null && row.delivery_days !== "" && (!isNum(row.delivery_days) || num(row.delivery_days) < 0)) errors.push("delivery_days must be a non-negative number");
    if (row.sentiment_index != null && row.sentiment_index !== "" && (!isNum(row.sentiment_index) || num(row.sentiment_index) < 0 || num(row.sentiment_index) > 1)) errors.push("sentiment_index must be between 0 and 1");
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      row: {
        region_code: region.value,
        date: row.date,
        checkout_success_rate: row.checkout_success_rate !== "" ? num(row.checkout_success_rate) : null,
        stockout_rate: row.stockout_rate !== "" ? num(row.stockout_rate) : null,
        delivery_days: row.delivery_days !== "" ? num(row.delivery_days) : null,
        sla_breach_rate: row.sla_breach_rate !== "" ? num(row.sla_breach_rate) : null,
        inventory_on_hand_pct: row.inventory_on_hand_pct !== "" ? num(row.inventory_on_hand_pct) : null,
        complaint_rate: row.complaint_rate !== "" ? num(row.complaint_rate) : null,
        sentiment_index: row.sentiment_index !== "" ? num(row.sentiment_index) : null,
      },
      naturalKey: `erp_ops:${region.canonical}:${row.date}`,
    };
  },

  crm_customers(row) {
    const errors = [];
    if (!row.customer_id) errors.push("customer_id is required");
    const region = resolveRegionField(row.region_name, "region_name");
    if (!region.ok) errors.push(region.error);
    if (row.signup_date && !DATE_RE.test(row.signup_date)) errors.push("signup_date must be YYYY-MM-DD");
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      row: {
        customer_id: String(row.customer_id),
        customer_segment: row.customer_segment || "unspecified",
        region_name: region.value,
        signup_date: row.signup_date || null,
      },
      naturalKey: `customer_id:${row.customer_id}`,
    };
  },

  crm_daily(row) {
    const errors = [];
    const region = resolveRegionField(row.region_name, "region_name");
    if (!region.ok) errors.push(region.error);
    if (!DATE_RE.test(row.date)) errors.push("date must be YYYY-MM-DD");
    if (!isNum(row.traffic) || num(row.traffic) < 0) errors.push("traffic must be a non-negative number");
    if (row.conversion_rate != null && row.conversion_rate !== "" && (!isNum(row.conversion_rate) || num(row.conversion_rate) < 0 || num(row.conversion_rate) > 1)) errors.push("conversion_rate must be a fraction between 0 and 1");
    if (row.churn_rate != null && row.churn_rate !== "" && (!isNum(row.churn_rate) || num(row.churn_rate) < 0 || num(row.churn_rate) > 1)) errors.push("churn_rate must be a fraction between 0 and 1");
    if (row.active_customers != null && row.active_customers !== "" && (!isNum(row.active_customers) || num(row.active_customers) < 0)) errors.push("active_customers must be a non-negative number");
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      row: {
        region_name: region.value,
        date: row.date,
        traffic: num(row.traffic),
        conversion_rate: row.conversion_rate !== "" ? num(row.conversion_rate) : null,
        churn_rate: row.churn_rate !== "" ? num(row.churn_rate) : null,
        renewal_rate: row.renewal_rate !== "" ? num(row.renewal_rate) : null,
        active_customers: row.active_customers !== "" ? num(row.active_customers) : null,
      },
      naturalKey: `crm_daily:${region.canonical}:${row.date}`,
    };
  },

  support_tickets(row) {
    const errors = [];
    if (!row.ticket_id) errors.push("ticket_id is required");
    if (!row.customer_id) errors.push("customer_id is required");
    const region = resolveRegionField(row.region_label, "region_label");
    if (!region.ok) errors.push(region.error);
    if (!ISO_RE.test(row.timestamp)) errors.push("timestamp must be ISO format, e.g. 2026-08-25T15:57:00Z");
    if (row.sentiment != null && row.sentiment !== "" && (!isNum(row.sentiment) || num(row.sentiment) < -1 || num(row.sentiment) > 1)) errors.push("sentiment must be between -1 and 1");
    if (!row.category) errors.push("category is required");
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      row: {
        ticket_id: String(row.ticket_id),
        customer_id: String(row.customer_id),
        region_label: region.value,
        timestamp: row.timestamp,
        category: row.category,
        sentiment: row.sentiment !== "" ? num(row.sentiment) : 0,
        issue_text: row.issue_text || "",
      },
      naturalKey: `ticket_id:${row.ticket_id}`,
    };
  },
};

export const VALID_TABLES = Object.keys(VALIDATORS);

export function validateRecord(table, row) {
  const validator = VALIDATORS[table];
  if (!validator) return { ok: false, errors: [`Unknown table "${table}". Must be one of: ${VALID_TABLES.join(", ")}`] };
  return validator(row);
}
