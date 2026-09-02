// ============================================================
// SHOPIFY CONNECTOR (real Admin REST API, not a mock)
// Requires env vars:
//   SHOPIFY_SHOP           e.g. "my-store" (the *.myshopify.com prefix)
//   SHOPIFY_ACCESS_TOKEN   Admin API access token (custom app or
//                          Shopify-installed app) with scopes:
//                          read_orders, read_checkouts
//
// Shopify gives us real revenue/orders/discounts/refunds directly,
// and a real checkout-success proxy via abandoned checkouts. It has
// NO concept of delivery SLA, stockouts, complaints, or sentiment ,
// those fields are intentionally left out of what this provider
// returns; the composer in sources/index.js overlays synthetic
// values for them so the app keeps working, and marks provenance
// so the UI can be honest about what's real.
// ============================================================

import { mapShopifyRegion } from "./regionMap.js";

const API_VERSION = "2024-01";

function authHeaders(accessToken) {
  return { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" };
}

async function shopifyGet(shop, accessToken, path, params = {}) {
  const url = new URL(`https://${shop}.myshopify.com/admin/api/${API_VERSION}${path}`);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    throw new Error(`Shopify API error ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json();
}

// Follows Shopify's Link-header cursor pagination.
async function shopifyGetAllPages(shop, accessToken, path, params, maxPages = 20) {
  let results = [];
  let url = new URL(`https://${shop}.myshopify.com/admin/api/${API_VERSION}${path}`);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  let page = 0;
  while (url && page < maxPages) {
    const res = await fetch(url, { headers: authHeaders(accessToken) });
    if (!res.ok) throw new Error(`Shopify API error ${res.status} on ${path}: ${await res.text()}`);
    const data = await res.json();
    const key = Object.keys(data)[0];
    results = results.concat(data[key] || []);
    const link = res.headers.get("link") || res.headers.get("Link");
    const next = link && link.split(",").find((p) => p.includes('rel="next"'));
    url = next ? new URL(next.slice(next.indexOf("<") + 1, next.indexOf(">"))) : null;
    page++;
  }
  return results;
}

function dayKey(iso) {
  return iso.slice(0, 10);
}

// Fetches the last `days` days of orders + abandoned checkouts and
// aggregates them into { date, region: "all", ...fields } rows ,
// same field names as the synthetic ERP rows, but every value here
// is computed from real Shopify order data.
export async function fetchShopifyErp({ shop, accessToken, days = 30 }) {
  if (!shop || !accessToken) throw new Error("Shopify: SHOPIFY_SHOP and SHOPIFY_ACCESS_TOKEN are required");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [orders, checkouts] = await Promise.all([
    shopifyGetAllPages(shop, accessToken, "/orders.json", { status: "any", created_at_min: since, limit: 250 }),
    shopifyGetAllPages(shop, accessToken, "/checkouts.json", { created_at_min: since, limit: 250 }).catch(() => []),
  ]);

  const byDate = new Map();
  const ensure = (date, region) => {
    const key = `${date}|${region}`;
    if (!byDate.has(key)) {
      byDate.set(key, { date, region, orders: 0, revenue: 0, discounts: 0, refunds: 0, subtotal: 0, abandonedCheckouts: 0 });
    }
    return byDate.get(key);
  };

  for (const o of orders) {
    const date = dayKey(o.created_at);
    const region = mapShopifyRegion(o);
    const row = ensure(date, region);
    row.orders += 1;
    row.revenue += Number(o.total_price || 0);
    row.subtotal += Number(o.subtotal_price || o.total_price || 0);
    row.discounts += Number(o.total_discounts || 0);
    row.refunds += (o.refunds || []).reduce((s, r) => s + (r.transactions || []).reduce((s2, t) => s2 + Number(t.amount || 0), 0), 0);
  }
  for (const c of checkouts) {
    const date = dayKey(c.created_at);
    const region = mapShopifyRegion(c);
    ensure(date, region).abandonedCheckouts += 1;
  }

  const rows = [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => ({
      date: r.date,
      region: r.region,
      orders: r.orders,
      revenue: Math.round(r.revenue),
      aov: r.orders ? r.revenue / r.orders : 0,
      discountRate: r.subtotal ? r.discounts / r.subtotal : 0,
      refundsRate: r.revenue ? r.refunds / r.revenue : 0,
      // real proxy: completed orders vs. orders + abandoned checkouts
      checkoutSuccessRate: r.orders + r.abandonedCheckouts ? r.orders / (r.orders + r.abandonedCheckouts) : null,
    }));

  const regionsSeen = [...new Set(rows.map((r) => r.region))];

  return {
    rows,
    regionsSeen,
    providedFields: ["orders", "revenue", "aov", "discountRate", "refundsRate", "checkoutSuccessRate"],
    missingFields: ["traffic", "conversion", "stockoutRate", "deliveryDays", "slaBreachRate", "sentimentScore", "churnRate"],
    meta: { lastUpdatedMs: Date.now(), cadence: "live (Shopify Admin API)" },
  };
}
