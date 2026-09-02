// ============================================================
// P4, DYNAMIC IMPACT ESTIMATION
// Replaces hardcoded expectedImpact strings in the action library
// with a real calculation from the hypothesis's own metrics,
// wherever the math is actually reliable. Two well-defined,
// non-speculative formulas are implemented:
//
//   1. Conversion-type driver (checkout, conversion, funnel):
//      recoverable orders = traffic_today * (baseline_conversion - current_conversion)
//      estimated revenue impact = recoverable_orders * current_AOV
//
//   2. Price-type driver (discounts, AOV compression):
//      estimated revenue impact = orders_today * (baseline_AOV - current_AOV)
//
// For every other driver (fulfillment, delivery, complaints, churn,
// sentiment, inventory, returns) there is no clean deterministic
// path from "this metric moved" to "this many currency units" with
// the data this prototype has, so this returns an explicit
// "Impact estimate unavailable" rather than a fabricated range.
// This is a deliberate scope boundary, not a bug: adding a reliable
// formula for those drivers needs more data (e.g. order-level
// churn-adjusted LTV) than the current ERP/CRM export carries.
// ============================================================

import { computeNodeMetrics } from "./engine.js";
import { round } from "./engine.js";

const CONVERSION_NODE_IDS = new Set(["checkout", "conversion"]);
const PRICE_NODE_IDS = new Set(["discounts"]);
const STOCKOUT_NODE_IDS = new Set(["inventory"]);
const RETURNS_NODE_IDS = new Set(["returns"]);

export function estimateImpact(dataset, region, node, currency = "\u20B9") {
  if (CONVERSION_NODE_IDS.has(node.id)) {
    return estimateConversionImpact(dataset, region, currency);
  }
  if (PRICE_NODE_IDS.has(node.id)) {
    return estimatePriceImpact(dataset, region, currency);
  }
  if (STOCKOUT_NODE_IDS.has(node.id)) {
    return estimateStockoutImpact(dataset, region, currency);
  }
  if (RETURNS_NODE_IDS.has(node.id)) {
    return estimateReturnsImpact(dataset, region, currency);
  }
  return {
    available: false,
    text: "Impact estimate unavailable.",
    reason: `No reliable deterministic formula connects "${node.label}" to a currency impact with the data currently available.`,
  };
}

function estimateConversionImpact(dataset, region, currency) {
  const conv = computeNodeMetrics(dataset, region, "conversion");
  const traffic = computeNodeMetrics(dataset, region, "traffic");
  const aov = computeNodeMetrics(dataset, region, "aov");

  const baselineConversion = conv.historicalBaseline;
  const currentConversion = conv.currentValue;
  const trafficToday = traffic.currentValue;
  const currentAov = aov.currentValue;

  const conversionGap = baselineConversion - currentConversion; // positive = conversion dropped
  if (conversionGap <= 0) {
    return { available: false, text: "Impact estimate unavailable.", reason: "Conversion is not currently below its baseline." };
  }

  const recoverableOrders = round(trafficToday * conversionGap, 1);
  const estimatedRevenueImpact = round(recoverableOrders * currentAov, 0);

  return {
    available: true,
    text: `Recovering conversion to baseline (${round(baselineConversion * 100, 2)}%) could recapture an estimated ${recoverableOrders.toLocaleString("en-IN")} orders/day \u00d7 current AOV ${currency}${Math.round(currentAov).toLocaleString("en-IN")} \u2248 ${currency}${estimatedRevenueImpact.toLocaleString("en-IN")}/day.`,
    formula: "recoverable_orders = traffic_today \u00d7 (baseline_conversion - current_conversion); impact = recoverable_orders \u00d7 current_AOV",
    inputs: { baselineConversion, currentConversion, trafficToday, currentAov },
    recoverableOrders,
    estimatedRevenueImpactPerDay: estimatedRevenueImpact,
  };
}

function estimatePriceImpact(dataset, region, currency) {
  const aov = computeNodeMetrics(dataset, region, "aov");
  const orders = computeNodeMetrics(dataset, region, "orders");

  const baselineAov = aov.historicalBaseline;
  const currentAov = aov.currentValue;
  const ordersToday = orders.currentValue;

  const aovGap = baselineAov - currentAov; // positive = AOV compressed
  if (aovGap <= 0) {
    return { available: false, text: "Impact estimate unavailable.", reason: "AOV is not currently below its baseline." };
  }

  const estimatedRevenueImpact = round(ordersToday * aovGap, 0);

  return {
    available: true,
    text: `Restoring AOV to baseline (${currency}${Math.round(baselineAov).toLocaleString("en-IN")}) at today's order volume (${Math.round(ordersToday).toLocaleString("en-IN")} orders) \u2248 ${currency}${estimatedRevenueImpact.toLocaleString("en-IN")}/day.`,
    formula: "impact = orders_today \u00d7 (baseline_AOV - current_AOV)",
    inputs: { baselineAov, currentAov, ordersToday },
    estimatedRevenueImpactPerDay: estimatedRevenueImpact,
  };
}

// Stockout rate directly represents the fraction of demand that
// couldn't be fulfilled, treating each stockout-affected order
// attempt as a lost order at today's AOV is the same class of
// direct, non-speculative multiplication as the conversion formula
// above (both are "a rate gap times a volume times a price").
function estimateStockoutImpact(dataset, region, currency) {
  const stockout = computeNodeMetrics(dataset, region, "stockoutRate");
  const orders = computeNodeMetrics(dataset, region, "orders");
  const aov = computeNodeMetrics(dataset, region, "aov");

  const baselineStockout = stockout.historicalBaseline;
  const currentStockout = stockout.currentValue;
  const ordersToday = orders.currentValue;
  const currentAov = aov.currentValue;

  const stockoutGap = currentStockout - baselineStockout; // positive = more stockouts than baseline
  if (stockoutGap <= 0) {
    return { available: false, text: "Impact estimate unavailable.", reason: "Stockout rate is not currently above its baseline." };
  }

  const lostOrders = round(ordersToday * stockoutGap, 1);
  const estimatedRevenueImpact = round(lostOrders * currentAov, 0);

  return {
    available: true,
    text: `Stockout rate is ${round(stockoutGap * 100, 1)}pp above baseline, at today's order volume that's an estimated ${lostOrders.toLocaleString("en-IN")} lost orders/day \u00d7 AOV ${currency}${Math.round(currentAov).toLocaleString("en-IN")} \u2248 ${currency}${estimatedRevenueImpact.toLocaleString("en-IN")}/day.`,
    formula: "lost_orders = orders_today \u00d7 (current_stockout_rate - baseline_stockout_rate); impact = lost_orders \u00d7 current_AOV",
    inputs: { baselineStockout, currentStockout, ordersToday, currentAov },
    estimatedRevenueImpactPerDay: estimatedRevenueImpact,
  };
}

// Elevated refund/return rate directly removes revenue that
// wouldn't have been refunded at the baseline rate, again a
// direct rate-gap x volume x price calculation, not a speculative
// churn/LTV-style estimate.
function estimateReturnsImpact(dataset, region, currency) {
  const returns = computeNodeMetrics(dataset, region, "returnRate");
  const orders = computeNodeMetrics(dataset, region, "orders");
  const aov = computeNodeMetrics(dataset, region, "aov");

  const baselineReturns = returns.historicalBaseline;
  const currentReturns = returns.currentValue;
  const ordersToday = orders.currentValue;
  const currentAov = aov.currentValue;

  const returnsGap = currentReturns - baselineReturns; // positive = more refunds than baseline
  if (returnsGap <= 0) {
    return { available: false, text: "Impact estimate unavailable.", reason: "Return/refund rate is not currently above its baseline." };
  }

  const extraRefundedOrders = round(ordersToday * returnsGap, 1);
  const estimatedRevenueImpact = round(extraRefundedOrders * currentAov, 0);

  return {
    available: true,
    text: `Return/refund rate is ${round(returnsGap * 100, 1)}pp above baseline, at today's order volume that's an estimated ${extraRefundedOrders.toLocaleString("en-IN")} extra refunded orders/day \u00d7 AOV ${currency}${Math.round(currentAov).toLocaleString("en-IN")} \u2248 ${currency}${estimatedRevenueImpact.toLocaleString("en-IN")}/day in avoidable refunds.`,
    formula: "extra_refunded_orders = orders_today \u00d7 (current_return_rate - baseline_return_rate); impact = extra_refunded_orders \u00d7 current_AOV",
    inputs: { baselineReturns, currentReturns, ordersToday, currentAov },
    estimatedRevenueImpactPerDay: estimatedRevenueImpact,
  };
}
