import { mulberry32, jitter } from "../rng.js";

// ============================================================
// SOURCE 1, ERP (genuinely order-line grain, its own naming)
// Two related tables, as a real ERP would actually have:
//   erpOrders  , one row per order (order_id, product_id,
//                 region_code, date, revenue, discount, refund)
//   erpOps     , one row per region/day (inventory + delivery
//                 operational snapshot; these are logistics
//                 concepts, not order-line concepts, so a real ERP
//                 keeps them in a separate operational table too)
//
// Region field name/format is intentionally ERP-specific:
// region_code = "N" | "S" | "W", NOT the same string the other
// two sources use. See data/reconciliation/reconcile.js for the
// canonicalization step this requires downstream.
//
// Disaggregated FROM the existing daily targets (generate.js
// buildRegionSeries) so the totals still land on the same known/
// novel/ambiguous demo scenarios, genuinely different records,
// same underlying ground truth.
// ============================================================

const REGION_CODE = { north: "N", south: "S", west: "W" };
const PRODUCT_IDS = ["SKU-APP-01", "SKU-ELE-02", "SKU-HOM-03"];

export function buildErpRaw(dailyTargetsByRegion) {
  const rand = mulberry32(90210);
  const erpOrders = [];
  const erpOps = [];
  let orderSeq = 1;

  for (const [region, rows] of Object.entries(dailyTargetsByRegion)) {
    const code = REGION_CODE[region] || region.slice(0, 1).toUpperCase();
    for (const day of rows) {
      const orderCount = Math.max(1, Math.round(day.orders));
      // disaggregate the day's revenue across individual orders,
      // jittered per-order but normalized to still sum to the target
      const rawShares = Array.from({ length: orderCount }, () => 0.6 + rand() * 0.8);
      const shareSum = rawShares.reduce((a, b) => a + b, 0);
      let runningRevenue = 0;
      for (let i = 0; i < orderCount; i++) {
        const isLast = i === orderCount - 1;
        const revenue = isLast
          ? Math.max(0, day.revenue - runningRevenue)
          : Math.round((rawShares[i] / shareSum) * day.revenue);
        runningRevenue += revenue;
        const discount = Math.round(revenue * jitter(rand, day.discountRate, 0.3));
        const refund = rand() < day.refundsRate ? Math.round(revenue * (0.5 + rand() * 0.5)) : 0;
        erpOrders.push({
          order_id: `ORD-${code}-${day.date.replace(/-/g, "")}-${String(orderSeq++).padStart(5, "0")}`,
          product_id: PRODUCT_IDS[Math.floor(rand() * PRODUCT_IDS.length)],
          region_code: code,
          date: day.date,
          revenue,
          discount,
          refund,
        });
      }
      erpOps.push({
        region_code: code,
        date: day.date,
        checkout_success_rate: day.checkoutSuccessRate,
        stockout_rate: day.stockoutRate,
        delivery_days: day.deliveryDays,
        sla_breach_rate: day.slaBreachRate,
        inventory_on_hand_pct: Math.max(0, 1 - day.stockoutRate * 3), // realistic-looking derived inventory gauge
        // Complaint rate and CX sentiment are day-level operational
        // signals (not derivable from the sparse ticket sample ,
        // see reconcile.js header note), kept here alongside the
        // other operational metrics rather than fabricated from
        // ticket-count arithmetic that would be too noisy at
        // realistic ticket volumes.
        complaint_rate: day.complaintRate,
        sentiment_index: day.sentimentScore,
      });
    }
  }

  return { erpOrders, erpOps };
}
