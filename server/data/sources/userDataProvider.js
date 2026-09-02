// ============================================================
// USER DATA PROVIDER
//
// Turns stored user-ingested records back into the exact row shape
// buildCanonicalModel() expects (same shape readCsv() produces ,
// see csvProvider.js), then runs them through the SAME
// reconciliation layer as every other data source. The analytics
// and intelligence engines have no idea these rows came from a
// user-submitted form instead of a CSV file or the synthetic
// generator, same contract, zero changes needed downstream.
// ============================================================

import { buildCanonicalModel } from "../reconciliation/reconcile.js";
import { listRecords, hasAnyUserData, recordCounts } from "./userDataStore.js";
import { syntheticDataset } from "./syntheticProvider.js";
import { REGIONS } from "../generate.js";

// Strips the internal bookkeeping fields (_id, _naturalKey,
// _ingestedAt, _batchId) back off before handing rows to the
// reconciliation layer, which only knows the real canonical schema.
function stripMeta(row) {
  const { _id, _naturalKey, _ingestedAt, _batchId, ...rest } = row;
  return rest;
}

// mode: "userdata" = user-ingested rows only (empty dataset if none
// yet ingested, an honest empty state, never a synthetic fallback
// pretending to be user data). "combined" = user rows merged
// alongside the full synthetic scaffold, so a judge can ingest a
// few real records and immediately see them influence an
// otherwise-familiar demo dataset rather than starting from zero.
export function loadUserDataset(mode = "userdata") {
  const erpOrders = listRecords("erp_orders").map(stripMeta);
  const erpOps = listRecords("erp_ops").map(stripMeta);
  const crmCustomers = listRecords("crm_customers").map(stripMeta);
  const crmDaily = listRecords("crm_daily").map(stripMeta);
  const supportTickets = listRecords("support_tickets").map(stripMeta);

  if (mode === "userdata" && !hasAnyUserData()) {
    return {
      regions: REGIONS,
      products: [],
      segments: [],
      erp: [],
      support: [],
      historicalScenarios: [],
      newProduct: null,
      sourceMeta: {
        ERP: { lastUpdatedMs: null, cadence: "no user data ingested yet" },
        CRM: { lastUpdatedMs: null, cadence: "no user data ingested yet" },
        Support: { lastUpdatedMs: null, cadence: "no user data ingested yet" },
      },
      reconciliationReport: null,
      isEmpty: true,
    };
  }

  let inputErpOrders = erpOrders;
  let inputErpOps = erpOps;
  let inputCrmCustomers = crmCustomers;
  let inputCrmDaily = crmDaily;
  let inputSupportTickets = supportTickets;
  let base = null;

  if (mode === "combined") {
    base = syntheticDataset();
    // synthetic dataset is already in canonical (post-reconciliation)
    // shape, not raw CSV shape, so we don't re-run it through
    // buildCanonicalModel, instead we reconcile ONLY the
    // user-submitted rows, then concatenate the two canonical
    // outputs. This avoids fabricating fake raw rows just to satisfy
    // a function signature.
  }

  const userErpCount = inputErpOrders.length + inputErpOps.length;
  const canonical = userErpCount > 0 || inputSupportTickets.length > 0
    ? buildCanonicalModel({
        erpOrders: inputErpOrders,
        erpOps: inputErpOps,
        crmDaily: inputCrmDaily,
        supportTickets: inputSupportTickets,
        crmCustomers: inputCrmCustomers,
      })
    : { erp: [], support: [], reconciliationReport: null };

  const erp = base ? [...base.erp, ...canonical.erp] : canonical.erp;
  const support = base ? [...base.support, ...canonical.support] : canonical.support;
  const regions = [...new Set(erp.map((r) => r.region))];
  const counts = recordCounts();
  const now = Date.now();

  return {
    regions: regions.length ? regions : REGIONS,
    products: base?.products || [],
    segments: base?.segments || [],
    erp,
    support,
    historicalScenarios: base?.historicalScenarios || [],
    newProduct: base?.newProduct || null,
    sourceMeta: {
      ERP: { lastUpdatedMs: now, cadence: `user-ingested (${counts.erp_orders} orders, ${counts.erp_ops} ops records)${base ? " + synthetic" : ""}` },
      CRM: { lastUpdatedMs: now, cadence: `user-ingested (${counts.crm_customers} customers, ${counts.crm_daily} daily records)${base ? " + synthetic" : ""}` },
      Support: { lastUpdatedMs: now, cadence: `user-ingested (${counts.support_tickets} tickets)${base ? " + synthetic" : ""}` },
    },
    reconciliationReport: canonical.reconciliationReport,
    isEmpty: false,
  };
}
