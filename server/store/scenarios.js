import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

// ============================================================
// P2, REAL BUSINESS MEMORY
// Seed historical scenarios (dataset.historicalScenarios) stay as
// curated starting data. This store is where NEW scenarios go once
// an insight is actually resolved and an analyst/business user
// confirms it, the mechanism the brief asks for. It is persisted
// outside the dataset object so it survives dataset regeneration
// (server restart, DATA_SOURCE reload) and accumulates over time,
// which a hardcoded seed list structurally cannot do.
//
// Two-step flow, matching "require confirmation before marking a
// scenario as confirmed":
//   1. proposeScenario() , snapshots a resolved insight as a DRAFT
//      (status: "pending_confirmation"). Anyone can propose.
//   2. confirmScenario() , an analyst/business user supplies the
//      confirmed cause, action taken, and outcome; only then does
//      status flip to "confirmed" and it becomes eligible for
//      future historical-similarity matching.
// ============================================================

const DATA_DIR = path.join(process.cwd(), ".store");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const SCENARIOS_FILE = path.join(DATA_DIR, "scenarios.json");

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
    console.error("Failed to persist store file", file, e.message);
  }
}

let scenarios = loadJson(SCENARIOS_FILE, []);

// Snapshots ONLY what the brief asks for: KPI state/fingerprint,
// driver tree state (flattened to keep the record small, full
// nested tree is derivable again from kpi+region+timestamp if ever
// needed), hypotheses, evidence, timestamp, persona. `confirmedCause`
// / `actionTaken` / `outcome` are filled in later by confirmScenario.
export function proposeScenario({ kpi, region, fingerprint, driverTreeSummary, hypotheses, evidence, persona, proposedBy }) {
  const record = {
    id: nanoid(10),
    status: "pending_confirmation",
    kpi,
    region,
    fingerprint,
    driverTreeSummary,
    hypotheses,
    evidence,
    persona,
    proposedBy,
    proposedAt: new Date().toISOString(),
    confirmedCause: null,
    actionTaken: null,
    outcome: null,
    confirmedBy: null,
    confirmedAt: null,
  };
  scenarios.push(record);
  saveJson(SCENARIOS_FILE, scenarios);
  return record;
}

export function confirmScenario(id, { confirmedCause, actionTaken, outcome, confirmedBy }) {
  const record = scenarios.find((s) => s.id === id);
  if (!record) return null;
  if (!confirmedCause || !actionTaken || !outcome) {
    throw new Error("confirmedCause, actionTaken, and outcome are all required to confirm a scenario");
  }
  record.status = "confirmed";
  record.confirmedCause = confirmedCause;
  record.actionTaken = actionTaken;
  record.outcome = outcome;
  record.confirmedBy = confirmedBy;
  record.confirmedAt = new Date().toISOString();
  saveJson(SCENARIOS_FILE, scenarios);
  return record;
}

export function listPendingScenarios() {
  return scenarios.filter((s) => s.status === "pending_confirmation");
}

// Shaped to match the seed historicalScenarios format so
// matchHistoricalScenarios() (analytics/engine.js) can treat seed
// and confirmed scenarios identically, see its `pool` merge.
export function listConfirmedScenarios() {
  return scenarios
    .filter((s) => s.status === "confirmed")
    .map((s) => ({
      id: s.id,
      title: `${s.kpi} \u2014 ${s.confirmedCause}`,
      date: s.confirmedAt,
      region: s.region,
      fingerprint: s.fingerprint,
      suspectedDriver: s.confirmedCause, // confirmed, but similarity is still never treated as proof of causality
      whatHappened: `Confirmed from a resolved investigation on ${s.proposedAt.slice(0, 10)}.`,
      actionTaken: s.actionTaken,
      outcome: s.outcome,
      actionWorked: null,
      source: "confirmed",
    }));
}

export function getScenario(id) {
  return scenarios.find((s) => s.id === id) || null;
}
