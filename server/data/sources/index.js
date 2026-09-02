import { syntheticDataset } from "./syntheticProvider.js";
import { loadCsvDataset } from "./csvProvider.js";
import { fetchShopifyErp } from "./shopifyProvider.js";
import { fetchZendeskTickets } from "./zendeskProvider.js";
import { fetchSalesforceCrm } from "./salesforceProvider.js";
import { loadUserDataset } from "./userDataProvider.js";

// Overlays real values onto the synthetic scaffold, keyed by
// date+region, WITHOUT discarding fields the live source doesn't
// provide. This is what lets Revenue reasoning run on a mix of
// "real orders, synthetic operational signals" without the
// analytics engine needing to know the difference.
//
// If regionMap.js has real mappings configured, `liveRows` will
// already carry your actual regions (north/south/west, etc.) and
// this overlays row-for-row. If no mapping is configured, every
// live row falls back to a single "all" bucket, in that case we
// collapse the synthetic baseline the same way so the two line up.
function overlayErp(baseRows, liveRows) {
  const liveRegions = [...new Set(liveRows.map((r) => r.region))];
  const isCollapsed = liveRegions.length <= 1 && liveRegions[0] === "all";

  if (isCollapsed) {
    const byDate = new Map();
    for (const r of baseRows) {
      if (!byDate.has(r.date)) byDate.set(r.date, { ...r, region: "all" });
      else {
        const acc = byDate.get(r.date);
        acc.orders += r.orders;
        acc.revenue += r.revenue;
        acc.traffic += r.traffic;
        acc.activeCustomers += r.activeCustomers;
      }
    }
    const liveByDate = new Map(liveRows.map((r) => [r.date, r]));
    const dates = new Set([...byDate.keys(), ...liveByDate.keys()]);
    return [...dates].sort().map((date) => {
      const base = byDate.get(date) || { date, region: "all" };
      const live = liveByDate.get(date);
      return live ? { ...base, ...Object.fromEntries(Object.entries(live).filter(([, v]) => v !== null && v !== undefined)) } : base;
    });
  }

  // Mapped mode: overlay per (date, region) key directly.
  const liveByKey = new Map(liveRows.map((r) => [`${r.date}|${r.region}`, r]));
  const baseKeys = new Set(baseRows.map((r) => `${r.date}|${r.region}`));
  const merged = baseRows.map((r) => {
    const live = liveByKey.get(`${r.date}|${r.region}`);
    return live ? { ...r, ...Object.fromEntries(Object.entries(live).filter(([, v]) => v !== null && v !== undefined)) } : r;
  });
  // include any live rows for date+region combos the synthetic baseline didn't have
  for (const [key, live] of liveByKey) {
    if (!baseKeys.has(key)) merged.push(live);
  }
  return merged;
}

export async function loadDataset() {
  const mode = (process.env.DATA_SOURCE || "synthetic").toLowerCase();
  const base = syntheticDataset();
  const provenance = { erp: "synthetic", crm: "synthetic", support: "synthetic" };

  if (mode === "csv") {
    try {
      const csv = loadCsvDataset();
      return { ...base, ...csv, provenance: { erp: "csv", crm: "csv", support: "csv" } };
    } catch (e) {
      console.error("CSV data source failed, falling back to synthetic:", e.message);
      return { ...base, provenance, dataSourceError: e.message };
    }
  }

  if (mode === "shopify" || mode === "zendesk" || mode === "blended") {
    let erp = base.erp;
    let support = base.support;
    const sourceMeta = { ...base.sourceMeta };
    const errors = [];

    if (mode !== "zendesk" && process.env.SHOPIFY_SHOP && process.env.SHOPIFY_ACCESS_TOKEN) {
      try {
        const shopify = await fetchShopifyErp({ shop: process.env.SHOPIFY_SHOP, accessToken: process.env.SHOPIFY_ACCESS_TOKEN });
        erp = overlayErp(base.erp, shopify.rows);
        sourceMeta.ERP = shopify.meta;
        const regionNote = shopify.regionsSeen.length > 1 || shopify.regionsSeen[0] !== "all"
          ? `mapped to regions: ${shopify.regionsSeen.join(", ")}`
          : `unmapped, configure regionMap.js for per-region live data (see README)`;
        provenance.erp = `shopify (live: ${shopify.providedFields.join(", ")}; ${regionNote}) + synthetic overlay for ${shopify.missingFields.join(", ")}`;
      } catch (e) {
        errors.push(`Shopify: ${e.message}`);
      }
    }

    if (mode !== "shopify" && process.env.ZENDESK_SUBDOMAIN && process.env.ZENDESK_API_TOKEN) {
      try {
        const zd = await fetchZendeskTickets({ subdomain: process.env.ZENDESK_SUBDOMAIN, email: process.env.ZENDESK_EMAIL, apiToken: process.env.ZENDESK_API_TOKEN });
        support = zd.tickets;
        sourceMeta.Support = zd.meta;
        provenance.support = `zendesk (live${zd.regionsSeen.length > 1 || zd.regionsSeen[0] !== "all" ? `, regions: ${zd.regionsSeen.join(", ")}` : ", unmapped"})`;
      } catch (e) {
        errors.push(`Zendesk: ${e.message}`);
      }
    }

    if (mode === "blended" && process.env.SF_CLIENT_ID) {
      try {
        const sf = await fetchSalesforceCrm({
          loginUrl: process.env.SF_LOGIN_URL,
          clientId: process.env.SF_CLIENT_ID,
          clientSecret: process.env.SF_CLIENT_SECRET,
          username: process.env.SF_USERNAME,
          password: process.env.SF_PASSWORD,
        });
        erp = overlayErp(erp, sf.rows);
        provenance.crm = `salesforce (live: ${sf.providedFields.join(", ")})`;
      } catch (e) {
        errors.push(`Salesforce: ${e.message}`);
      }
    }

    if (erp !== base.erp) {
      const liveRegions = [...new Set(erp.map((r) => r.region))];
      return { ...base, erp, support, regions: liveRegions, sourceMeta, provenance, dataSourceErrors: errors };
    }
    return { ...base, support, sourceMeta, provenance, dataSourceErrors: errors };
  }

  return { ...base, provenance };
}

// ------------------------------------------------------------------
// Per-request dataset selection for the "Demo / My Data" switch
// (see routes/*.js's dataModeMiddleware). Completely separate from
// loadDataset() above, which stays exactly as it was, the demo
// path (app.locals.dataset, loaded once at boot) is untouched by
// any of this, so existing behavior is byte-for-byte unchanged when
// no data-mode header is sent. Only called when a request actually
// asks for "userdata" or "combined" mode.
// ------------------------------------------------------------------
export function loadDatasetForMode(mode, demoDataset) {
  if (mode === "userdata" || mode === "combined") {
    const userDs = loadUserDataset(mode);
    return { ...userDs, provenance: { erp: mode, crm: mode, support: mode } };
  }
  return demoDataset;
}
