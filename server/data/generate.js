import { mulberry32, jitter } from "./rng.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NUM_DAYS = 30; // index 0 = oldest, 29 = "today"
const TODAY = new Date();
TODAY.setHours(9, 0, 0, 0);

function dateForIndex(i) {
  const d = new Date(TODAY.getTime() - (NUM_DAYS - 1 - i) * DAY_MS);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------
// Region baselines. Each region intentionally tells a different
// investigative story on "today" (index 29):
//   north  -> KNOWN historical pattern (checkout/payment disruption)
//   south  -> NOVEL pattern (fulfillment/supply disruption)
//   west   -> AMBIGUOUS (several close, non-dominant drivers)
// ------------------------------------------------------------------
const REGION_BASELINE = {
  north: {
    revenue: 500000, orders: 1200, traffic: 15000, aov: 417,
    conversion: 0.08, deliveryDays: 2.5, slaBreach: 0.04,
    complaintRate: 0.015, checkoutSuccess: 0.96, stockout: 0.03,
    discountRate: 0.08, sentiment: 0.62, churnRate: 0.02, activeCustomers: 42000,
  },
  south: {
    revenue: 380000, orders: 900, traffic: 12000, aov: 422,
    conversion: 0.075, deliveryDays: 3.0, slaBreach: 0.05,
    complaintRate: 0.018, checkoutSuccess: 0.955, stockout: 0.04,
    discountRate: 0.09, sentiment: 0.58, churnRate: 0.022, activeCustomers: 31000,
  },
  west: {
    revenue: 300000, orders: 700, traffic: 9500, aov: 428,
    conversion: 0.074, deliveryDays: 2.8, slaBreach: 0.045,
    complaintRate: 0.016, checkoutSuccess: 0.958, stockout: 0.035,
    discountRate: 0.085, sentiment: 0.6, churnRate: 0.021, activeCustomers: 24000,
  },
};

const PRODUCTS = ["apparel", "electronics", "home"];
const SEGMENTS = ["enterprise", "smb", "consumer"];
const REGIONS = ["north", "south", "west"];

function buildRegionSeries(region, seedBase) {
  const rand = mulberry32(seedBase);
  const base = REGION_BASELINE[region];
  const rows = [];

  for (let i = 0; i < NUM_DAYS; i++) {
    const isToday = i === NUM_DAYS - 1;
    const date = dateForIndex(i);

    // mild organic noise for the whole history, small weekly seasonality
    const weekday = new Date(date).getDay();
    const weekendDamp = weekday === 0 || weekday === 6 ? 0.92 : 1.0;

    let row = {
      date, region,
      traffic: Math.round(jitter(rand, base.traffic, 0.03) * weekendDamp),
      conversion: jitter(rand, base.conversion, 0.025),
      aov: jitter(rand, base.aov, 0.015),
      deliveryDays: jitter(rand, base.deliveryDays, 0.04),
      slaBreachRate: jitter(rand, base.slaBreach, 0.08),
      complaintRate: jitter(rand, base.complaintRate, 0.08),
      checkoutSuccessRate: jitter(rand, base.checkoutSuccess, 0.008),
      stockoutRate: jitter(rand, base.stockout, 0.08),
      discountRate: jitter(rand, base.discountRate, 0.06),
      sentimentScore: jitter(rand, base.sentiment, 0.06),
      churnRate: jitter(rand, base.churnRate, 0.08),
      activeCustomers: Math.round(jitter(rand, base.activeCustomers, 0.01)),
      refundsRate: jitter(rand, 0.02, 0.1),
    };

    // ---- inject "today" scenario shocks ----
    if (isToday && region === "north") {
      // KNOWN PATTERN: checkout / payment gateway disruption
      row.checkoutSuccessRate = base.checkoutSuccess * 0.855; // ~ -14.5pp relative -> conversion follows
      row.conversion = base.conversion * 0.928; // -7.2%
      row.complaintRate = base.complaintRate * 1.25; // +25%
      row.traffic = Math.round(base.traffic * 0.97); // -3%
      row.deliveryDays = base.deliveryDays * 1.02;
      row.slaBreachRate = base.slaBreach * 1.05;
      row.sentimentScore = base.sentiment * 0.9;
    }
    if (isToday && region === "south") {
      // NOVEL PATTERN: fulfillment / supply disruption, no checkout issue
      row.stockoutRate = base.stockout * 5.5; // sharp spike
      row.deliveryDays = base.deliveryDays * 1.93;
      row.slaBreachRate = base.slaBreach * 6.2;
      row.complaintRate = base.complaintRate * 1.6;
      row.conversion = base.conversion * 0.99; // basically flat
      row.checkoutSuccessRate = base.checkoutSuccess * 0.995; // flat
      row.traffic = Math.round(base.traffic * 1.01);
      row.sentimentScore = base.sentiment * 0.82;
    }
    if (isToday && region === "west") {
      // AMBIGUOUS: conversion, delivery, and churn all move together,
      // none dominant enough to isolate.
      row.conversion = base.conversion * 0.94; // -6%
      row.deliveryDays = base.deliveryDays * 1.18; // +18%
      row.slaBreachRate = base.slaBreach * 1.35;
      row.churnRate = base.churnRate * 1.32; // +32% relative churn tick-up
      row.complaintRate = base.complaintRate * 1.2;
      row.checkoutSuccessRate = base.checkoutSuccess * 0.99;
      row.traffic = Math.round(base.traffic * 0.98);
      row.sentimentScore = base.sentiment * 0.93;
    }

    row.orders = Math.round(row.traffic * row.conversion);
    row.revenue = Math.round(row.orders * row.aov * (1 - row.refundsRate * 0.3));

    // Apply an explicit, reliable revenue shock on "today" so the
    // demo scenarios hold regardless of incidental day-to-day noise
    // in aov/traffic. The upstream driver metrics above are what the
    // investigation engine actually reasons over; this just makes
    // sure the root KPI move is large enough to be flagged material.
    if (isToday) {
      const REVENUE_SHOCK = { north: 0.912, south: 0.878, west: 0.902 };
      if (REVENUE_SHOCK[region]) {
        row.revenue = Math.round(row.revenue * REVENUE_SHOCK[region]);
      }
    }
    rows.push(row);
  }
  return rows;
}

function buildSupportTickets(erpByRegion) {
  const rand = mulberry32(777);
  const categories = {
    north: [
      ["payment", "Payment failed at checkout, card charged but order not confirmed", -0.8],
      ["payment", "Getting a gateway timeout error on checkout page", -0.75],
      ["complaint", "Frustrated, tried to pay three times and it kept failing", -0.85],
    ],
    south: [
      ["delivery", "Order still not shipped, tracking hasn't updated in 5 days", -0.7],
      ["delivery", "Item shows out of stock after I already paid for it", -0.72],
      ["fulfillment", "Warehouse delay pushed my delivery window back a week", -0.68],
    ],
    west: [
      ["delivery", "Delivery is taking longer than usual this week", -0.5],
      ["product", "Considering cancelling my subscription, service feels slower lately", -0.6],
      ["complaint", "Support response time has gotten worse recently", -0.55],
    ],
  };
  const generic = [
    ["product", "Question about return policy for electronics", 0.1],
    ["other", "Loved the new packaging, nice touch", 0.6],
    ["product", "Asking about restock date for a home goods item", -0.1],
  ];

  const tickets = [];
  let ticketSeq = 10000;
  for (const region of REGIONS) {
    const isTodayShockRegion = region === "north" || region === "south" || region === "west";
    const dayCount = isTodayShockRegion ? 30 : 12; // more tickets recently for shock regions
    for (let i = 0; i < dayCount; i++) {
      const dayIdx = NUM_DAYS - 1 - Math.floor(rand() * (i < dayCount * 0.6 ? 4 : 20));
      const date = dateForIndex(Math.max(0, dayIdx));
      const pool = rand() < 0.75 ? categories[region] : generic;
      const [category, issue, sentiment] = pool[Math.floor(rand() * pool.length)];
      tickets.push({
        ticketId: `TCK-${ticketSeq++}`,
        date,
        region,
        customerId: `CUST-${Math.floor(rand() * 90000 + 10000)}`,
        category,
        issue,
        sentiment: Number(sentiment.toFixed(2)),
        freeText: issue,
      });
    }
  }
  return tickets;
}

function buildHistoricalScenarios() {
  // Hand-authored past business incidents with fingerprint vectors
  // [revenueDelta, conversionDelta, complaintsDelta, deliveryDelta, trafficDelta]
  // expressed as fractional change vs. expected baseline.
  return [
    {
      id: "hs_2026_03_gateway",
      title: "March Payment Gateway Outage",
      date: "2026-03-14",
      region: "north",
      fingerprint: { revenue: -0.09, conversion: -0.08, complaints: 0.28, delivery: 0.02, traffic: -0.04 },
      suspectedDriver: "Checkout / payment gateway disruption",
      whatHappened:
        "A third-party payment gateway experienced intermittent failures for roughly 18 hours, causing checkout errors for a subset of customers.",
      actionTaken: "Routed affected traffic to a backup payment gateway and issued goodwill credits to impacted customers.",
      outcome: "Revenue recovered to baseline within 3 days; conversion returned to normal within 36 hours.",
      actionWorked: true,
    },
    {
      id: "hs_2025_11_warehouse_fire",
      title: "Regional Warehouse Disruption",
      date: "2025-11-02",
      region: "south",
      fingerprint: { revenue: -0.06, conversion: -0.01, complaints: 0.12, delivery: 0.35, traffic: 0.0 },
      suspectedDriver: "Single-warehouse capacity loss",
      whatHappened: "A regional distribution center went offline for two days due to a facilities issue, causing localized stockouts.",
      actionTaken: "Rerouted fulfillment to a neighboring warehouse.",
      outcome: "Partial recovery; some SLA impact persisted for a week.",
      actionWorked: true,
    },
    {
      id: "hs_2025_08_holiday_demand",
      title: "Holiday Demand Spike",
      date: "2025-08-20",
      region: "north",
      fingerprint: { revenue: 0.15, conversion: 0.05, complaints: 0.05, delivery: 0.1, traffic: 0.2 },
      suspectedDriver: "Seasonal demand surge",
      whatHappened: "A planned promotional campaign drove a temporary demand spike.",
      actionTaken: "Scaled customer support staffing for the week.",
      outcome: "No negative business impact; treated as expected seasonality.",
      actionWorked: true,
    },
    {
      id: "hs_2025_05_pricing_change",
      title: "Q1 Pricing Policy Change",
      date: "2025-05-10",
      region: "west",
      fingerprint: { revenue: -0.03, conversion: -0.02, complaints: 0.02, delivery: 0.0, traffic: -0.01 },
      suspectedDriver: "Price increase on core SKUs",
      whatHappened: "A planned ASP increase modestly softened demand.",
      actionTaken: "None. Accepted as an intentional pricing trade-off.",
      outcome: "Margin improved despite modest volume softness.",
      actionWorked: true,
    },
  ];
}

function buildNewProductSeries() {
  // Sparse-history demo: a product launched 10 days ago in West.
  const rand = mulberry32(2026);
  const days = [];
  for (let i = 0; i < 10; i++) {
    const idx = NUM_DAYS - 10 + i;
    days.push({
      date: dateForIndex(idx),
      region: "west",
      product: "west_new_gadget",
      orders: Math.round(jitter(rand, 40 + i * 6, 0.15)), // early adoption ramp
      revenue: Math.round(jitter(rand, (40 + i * 6) * 65, 0.15)),
    });
  }
  return { product: "west_new_gadget", region: "west", launchDate: dateForIndex(NUM_DAYS - 10), days };
}

// Exported so the heterogeneous raw-source generators (data/rawSources/)
// can disaggregate genuinely different-shaped ERP/CRM/Support records
// that still sum/average back to these same daily targets, this is
// what keeps the P0#1 rebuild from silently breaking the existing
// known/novel/ambiguous demo scenarios, which were tuned against
// these exact numbers.
export { buildRegionSeries, REGIONS, PRODUCTS, SEGMENTS, REGION_BASELINE };

export function generateData() {
  const erp = REGIONS.flatMap((r, idx) => buildRegionSeries(r, 1000 + idx * 37));
  const support = buildSupportTickets(erp);
  const historicalScenarios = buildHistoricalScenarios();
  const newProduct = buildNewProductSeries();

  const now = Date.now();
  const sourceMeta = {
    ERP: { lastUpdatedMs: now - 14 * 60 * 1000, cadence: "hourly" },
    CRM: { lastUpdatedMs: now - 3 * 60 * 60 * 1000, cadence: "daily" },
    Support: { lastUpdatedMs: now - 2 * 60 * 1000, cadence: "near real-time" },
  };

  return { regions: REGIONS, products: PRODUCTS, segments: SEGMENTS, erp, support, historicalScenarios, newProduct, sourceMeta };
}
