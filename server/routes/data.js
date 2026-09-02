// ============================================================
// DATA INGESTION ROUTES
//
// Everything here writes to the JSON-file user-data store (see
// data/sources/userDataStore.js) and validates against the exact
// canonical schema the reconciliation layer expects (see
// data/validation/validateRecord.js). Nothing here touches the
// demo/synthetic dataset, "My Data" and "Demo" are fully separate
// until a request explicitly asks for "userdata" or "combined" mode
// via the X-Data-Mode header (see middleware/dataMode.js).
// ============================================================

import { Router } from "express";
import { nanoid } from "nanoid";
import { parse } from "csv-parse/sync";
import { requireAuth } from "../auth/middleware.js";
import { validateRecord, VALID_TABLES } from "../data/validation/validateRecord.js";
import {
  appendRecords,
  listRecords,
  deleteRecord,
  listBatches,
  getBatch,
  recordCounts,
} from "../data/sources/userDataStore.js";

const router = Router();
router.use(requireAuth);

// Groups the 5 canonical tables under the 3 source categories the
// frontend/spec think in terms of (ERP / CRM / Support).
const SOURCE_GROUPS = {
  erp: ["erp_orders", "erp_ops"],
  crm: ["crm_customers", "crm_daily"],
  support: ["support_tickets"],
};

function validateBatch(table, records) {
  const valid = [];
  const rejected = [];
  for (const row of records) {
    const result = validateRecord(table, row);
    if (result.ok) valid.push(result);
    else rejected.push({ row, errors: result.errors });
  }
  return { valid, rejected };
}

// ------------------------------------------------------------------
// GET /api/data/sources, health/count overview per source category
// ------------------------------------------------------------------
router.get("/sources", (req, res) => {
  const counts = recordCounts();
  const summarize = (tables) => {
    const total = tables.reduce((sum, t) => sum + (counts[t] || 0), 0);
    return { recordCount: total, tables: Object.fromEntries(tables.map((t) => [t, counts[t] || 0])), healthy: true };
  };
  res.json({
    erp: summarize(SOURCE_GROUPS.erp),
    crm: summarize(SOURCE_GROUPS.crm),
    support: summarize(SOURCE_GROUPS.support),
  });
});

// ------------------------------------------------------------------
// GET /api/data/health, overall data-quality summary
// ------------------------------------------------------------------
router.get("/health", (req, res) => {
  const counts = recordCounts();
  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
  const recentBatches = listBatches(20);
  const totalReceived = recentBatches.reduce((a, b) => a + b.received, 0);
  const totalRejected = recentBatches.reduce((a, b) => a + b.rejected, 0);
  const validity = totalReceived > 0 ? Number((1 - totalRejected / totalReceived).toFixed(3)) : null;
  res.json({
    totalRecords,
    counts,
    recentBatchCount: recentBatches.length,
    validity,
    lastIngestedAt: recentBatches[0]?.createdAt || null,
  });
});

// ------------------------------------------------------------------
// GET /api/data/records?table=erp_orders, list stored records
// ------------------------------------------------------------------
router.get("/records", (req, res) => {
  const table = req.query.table;
  if (!table || !VALID_TABLES.includes(table)) {
    return res.status(400).json({ error: `table query param required, one of: ${VALID_TABLES.join(", ")}` });
  }
  res.json({ table, records: listRecords(table) });
});

// ------------------------------------------------------------------
// DELETE /api/data/records/:table/:id
// ------------------------------------------------------------------
router.delete("/records/:table/:id", (req, res) => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) {
    return res.status(400).json({ error: `Unknown table "${table}"` });
  }
  const removed = deleteRecord(table, id);
  if (!removed) return res.status(404).json({ error: "Record not found" });
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// GET /api/data/batches, ingestion history
// ------------------------------------------------------------------
router.get("/batches", (req, res) => {
  res.json({ batches: listBatches(50) });
});

router.get("/batches/:id", (req, res) => {
  const batch = getBatch(req.params.id);
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json(batch);
});

// ------------------------------------------------------------------
// POST /api/data/ingest, manual entry or pre-parsed CSV rows
// Body: { table: "erp_orders", records: [...], method: "manual"|"csv" }
// ------------------------------------------------------------------
router.post("/ingest", (req, res) => {
  const { table, records, method } = req.body || {};
  if (!table || !VALID_TABLES.includes(table)) {
    return res.status(400).json({ error: `table is required, one of: ${VALID_TABLES.join(", ")}` });
  }
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "records must be a non-empty array" });
  }
  if (records.length > 5000) {
    return res.status(400).json({ error: "Max 5000 records per ingestion request" });
  }

  const { valid, rejected } = validateBatch(table, records);

  if (valid.length === 0) {
    return res.status(422).json({
      success: false,
      table,
      inserted: 0,
      duplicates: 0,
      rejected: rejected.length,
      rejectedDetails: rejected.slice(0, 50),
    });
  }

  const batchId = nanoid(10);
  const result = appendRecords(table, valid, {
    batchId,
    source: table,
    method: method || "manual",
    rejectedCount: rejected.length,
    rejectedDetails: rejected.slice(0, 50),
  });

  res.json({
    success: true,
    table,
    inserted: result.inserted,
    duplicates: result.duplicates,
    rejected: rejected.length,
    rejectedDetails: rejected.slice(0, 50),
    batchId,
  });
});

// ------------------------------------------------------------------
// POST /api/data/ingest/csv-preview, parses raw CSV text, validates
// every row, but does NOT store anything. Lets the frontend show a
// preview (valid/invalid/duplicate counts) before the user confirms.
// Body: { table: "erp_orders", csvText: "..." }
// ------------------------------------------------------------------
router.post("/ingest/csv-preview", (req, res) => {
  const { table, csvText } = req.body || {};
  if (!table || !VALID_TABLES.includes(table)) {
    return res.status(400).json({ error: `table is required, one of: ${VALID_TABLES.join(", ")}` });
  }
  if (!csvText || typeof csvText !== "string") {
    return res.status(400).json({ error: "csvText is required" });
  }

  let rows;
  try {
    rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: `Could not parse CSV: ${e.message}` });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: "CSV has no data rows" });
  }
  if (rows.length > 5000) {
    return res.status(400).json({ error: `CSV has ${rows.length} rows, max 5000 per upload` });
  }

  const { valid, rejected } = validateBatch(table, rows);
  const existingKeys = new Set(listRecords(table).map((r) => r._naturalKey));
  const alreadyStored = valid.filter((v) => existingKeys.has(v.naturalKey)).length;

  res.json({
    table,
    totalRows: rows.length,
    validCount: valid.length,
    invalidCount: rejected.length,
    duplicateCount: alreadyStored,
    columns: Object.keys(rows[0] || {}),
    sampleValidRows: valid.slice(0, 5).map((v) => v.row),
    rejectedDetails: rejected.slice(0, 20),
    // Send back through /ingest to actually commit, this endpoint
    // never writes.
    committable: valid.map((v) => v.row),
  });
});

export default router;
