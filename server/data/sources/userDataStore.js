// ============================================================
// USER DATA STORE
//
// Persists user-ingested business records. Follows the exact same
// pattern as server/store/db.js (which already does this for
// feedback/telemetry), plain JSON files under .store/, no new
// database technology introduced. This is a deliberate choice: the
// project has no MongoDB/Mongoose anywhere today (verified, not
// even in package.json), and adding a real external database
// dependency that can't be provisioned or tested in this
// environment would be a far bigger architectural change than
// reusing the persistence pattern already used everywhere else in
// this app. Functionally this delivers everything the ingestion
// pipeline needs: durable storage, per-record IDs, batch tracking,
// duplicate detection, without requiring a MongoDB instance the
// user would have to separately stand up.
// ============================================================

import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { VALID_TABLES } from "../validation/validateRecord.js";

const DATA_DIR = path.join(process.cwd(), ".store", "user-data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const BATCHES_FILE = path.join(DATA_DIR, "_batches.json");

function tableFile(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to persist user-data store file", file, e.message);
  }
}

const tableCache = {};
for (const t of VALID_TABLES) tableCache[t] = loadJson(tableFile(t), []);
let batches = loadJson(BATCHES_FILE, []);

export function listRecords(table) {
  return tableCache[table] || [];
}

export function listAllRecords() {
  const out = {};
  for (const t of VALID_TABLES) out[t] = tableCache[t];
  return out;
}

// Inserts validated rows for one table, skipping any whose
// naturalKey already exists (source-level duplicate detection ,
// e.g. the same order_id or ticket_id submitted twice).
export function appendRecords(table, validatedRecords, batchMeta) {
  const existing = tableCache[table] || (tableCache[table] = []);
  const existingKeys = new Set(existing.map((r) => r._naturalKey));

  let inserted = 0;
  let duplicates = 0;
  const insertedIds = [];

  for (const { row, naturalKey } of validatedRecords) {
    if (existingKeys.has(naturalKey)) {
      duplicates++;
      continue;
    }
    const id = nanoid(10);
    existing.push({
      _id: id,
      _naturalKey: naturalKey,
      _ingestedAt: new Date().toISOString(),
      _batchId: batchMeta.batchId,
      ...row,
    });
    existingKeys.add(naturalKey);
    insertedIds.push(id);
    inserted++;
  }

  saveJson(tableFile(table), existing);

  const batchRecord = {
    id: batchMeta.batchId,
    table,
    source: batchMeta.source,
    method: batchMeta.method,
    createdAt: new Date().toISOString(),
    received: validatedRecords.length + (batchMeta.rejectedCount || 0),
    inserted,
    duplicates,
    rejected: batchMeta.rejectedCount || 0,
    rejectedDetails: batchMeta.rejectedDetails || [],
  };
  batches.push(batchRecord);
  if (batches.length > 200) batches = batches.slice(-200);
  saveJson(BATCHES_FILE, batches);

  return { inserted, duplicates, rejected: batchMeta.rejectedCount || 0, batch: batchRecord };
}

export function deleteRecord(table, id) {
  const existing = tableCache[table] || [];
  const idx = existing.findIndex((r) => r._id === id);
  if (idx === -1) return false;
  existing.splice(idx, 1);
  saveJson(tableFile(table), existing);
  return true;
}

export function listBatches(limit = 50) {
  return batches.slice(-limit).reverse();
}

export function getBatch(id) {
  return batches.find((b) => b.id === id) || null;
}

export function hasAnyUserData() {
  return VALID_TABLES.some((t) => (tableCache[t] || []).length > 0);
}

export function recordCounts() {
  const out = {};
  for (const t of VALID_TABLES) out[t] = (tableCache[t] || []).length;
  return out;
}
