import { mulberry32 } from "../rng.js";

// ============================================================
// SOURCE 2, CRM (customer grain + region-daily activity, its
// own naming: region_name = "North" | "South" | "West", Title
// Case, a different string than ERP's "N"/"S"/"W" or Support's
// "north-region".)
//
// crmCustomers , a real customer roster (dimension table): this
//                 is the join target Support ticket customer_id
//                 values are reconciled against.
// crmDaily     , region/day activity aggregate: traffic,
//                 conversion, churn, renewal, active customers.
//                 Sourced from the same daily targets as ERP so
//                 the demo scenarios still hold after aggregation.
// ============================================================

const REGION_NAME = { north: "North", south: "South", west: "West" };
const SEGMENTS = ["enterprise", "smb", "consumer"];

export function buildCrmRaw(dailyTargetsByRegion, customersPerRegion = 220) {
  const rand = mulberry32(31415);
  const crmCustomers = [];
  const crmDaily = [];

  for (const [region, rows] of Object.entries(dailyTargetsByRegion)) {
    const name = REGION_NAME[region] || region;

    // Customer roster, the entity table reconciliation joins against.
    for (let i = 0; i < customersPerRegion; i++) {
      crmCustomers.push({
        customer_id: `CUST-${region.slice(0, 1).toUpperCase()}${String(10000 + i)}`,
        customer_segment: SEGMENTS[Math.floor(rand() * SEGMENTS.length)],
        region_name: name,
        signup_date: `202${4 + Math.floor(rand() * 2)}-0${1 + Math.floor(rand() * 9)}-15`,
      });
    }

    // Region/day activity, a genuinely different grain from ERP's
    // order-line rows and Support's ticket rows.
    for (const day of rows) {
      crmDaily.push({
        region_name: name,
        date: day.date,
        traffic: Math.round(day.traffic),
        conversion_rate: day.conversion,
        churn_rate: day.churnRate,
        renewal_rate: Math.max(0, 1 - day.churnRate * 1.4),
        active_customers: Math.round(day.activeCustomers),
      });
    }
  }

  return { crmCustomers, crmDaily };
}
