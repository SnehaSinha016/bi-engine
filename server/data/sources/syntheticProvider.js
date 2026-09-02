import { generateData, buildRegionSeries, REGIONS } from "../generate.js";
import { buildErpRaw } from "../rawSources/erpRaw.js";
import { buildCrmRaw } from "../rawSources/crmRaw.js";
import { buildSupportRaw } from "../rawSources/supportRaw.js";
import { buildCanonicalModel } from "../reconciliation/reconcile.js";

// ============================================================
// P0#1 REBUILD: three genuinely heterogeneous raw sources ->
// reconciliation layer -> canonical model, instead of one flat
// table with cosmetic ERP/CRM/Support labels.
//
// historicalScenarios/newProduct/products/segments are unrelated
// to the reconciliation rebuild (they're curated business-memory
// seed data, not transactional records), so they're still sourced
// from the original generate.js, only erp[]/support[]/sourceMeta
// are replaced with the reconciled output.
// ============================================================
export function syntheticDataset() {
  const legacy = generateData(); // historicalScenarios, newProduct, products, segments

  // Daily targets per region, the "ground truth" the known/novel/
  // ambiguous demo scenarios are tuned against. The raw sources
  // below disaggregate these into genuinely different-shaped
  // records; reconciliation aggregates them back to the same
  // canonical daily numbers.
  const dailyTargetsByRegion = {};
  REGIONS.forEach((region, idx) => {
    dailyTargetsByRegion[region] = buildRegionSeries(region, 1000 + idx * 37);
  });
  const dates = dailyTargetsByRegion[REGIONS[0]].map((r) => r.date);

  const { erpOrders, erpOps } = buildErpRaw(dailyTargetsByRegion);
  const { crmCustomers, crmDaily } = buildCrmRaw(dailyTargetsByRegion);
  const supportTickets = buildSupportRaw(dailyTargetsByRegion, crmCustomers, dates);

  const { erp, support, reconciliationReport } = buildCanonicalModel({
    erpOrders, erpOps, crmDaily, supportTickets, crmCustomers,
  });

  const now = Date.now();
  const sourceMeta = {
    ERP: { lastUpdatedMs: now - 14 * 60 * 1000, cadence: "hourly" },
    CRM: { lastUpdatedMs: now - 3 * 60 * 60 * 1000, cadence: "daily" },
    Support: { lastUpdatedMs: now - 2 * 60 * 1000, cadence: "near real-time" },
  };

  return {
    regions: REGIONS,
    products: legacy.products,
    segments: legacy.segments,
    erp,
    support,
    historicalScenarios: legacy.historicalScenarios,
    newProduct: legacy.newProduct,
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
