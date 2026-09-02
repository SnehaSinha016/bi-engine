import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const DATA_DIR = path.join(process.cwd(), ".store");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");
const TELEMETRY_FILE = path.join(DATA_DIR, "telemetry.json");

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

let feedback = loadJson(FEEDBACK_FILE, []);
let telemetry = loadJson(TELEMETRY_FILE, []);

export function addFeedback(entry) {
  const record = {
    id: nanoid(8),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  feedback.push(record);
  saveJson(FEEDBACK_FILE, feedback);
  return record;
}

export function listFeedback() {
  return feedback;
}

// A very lightweight signal: if analysts have previously marked a
// hypothesis as incorrect for this KPI+region+hypothesisId combo,
// nudge its ranking down next time. This demonstrates that feedback
// influences future behavior without needing real model retraining.
export function feedbackPenaltyFor(kpi, region, hypothesisId) {
  const relevant = feedback.filter(
    (f) => f.kpi === kpi && f.region === region && f.hypothesisId === hypothesisId
  );
  if (!relevant.length) return 0;
  const incorrect = relevant.filter((f) => f.verdict === "incorrect").length;
  const correct = relevant.filter((f) => f.verdict === "correct").length;
  return incorrect * 8 - correct * 4; // penalty applied to confidence score
}

export function addTelemetry(entry) {
  const record = {
    id: nanoid(8),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  telemetry.push(record);
  if (telemetry.length > 500) telemetry = telemetry.slice(-500);
  saveJson(TELEMETRY_FILE, telemetry);
  return record;
}

export function listTelemetry(limit = 50) {
  return telemetry.slice(-limit).reverse();
}

export function telemetrySummary() {
  if (!telemetry.length) {
    return { count: 0, avgLatencyMs: 0, avgLlmCalls: 0, avgTokens: 0, avgCostUsd: 0 };
  }
  const n = telemetry.length;
  const sum = (fn) => telemetry.reduce((s, t) => s + (fn(t) || 0), 0);
  return {
    count: n,
    avgLatencyMs: Math.round(sum((t) => t.latencyMs) / n),
    avgLlmCalls: Number((sum((t) => t.llmCalls) / n).toFixed(2)),
    avgTokens: Math.round(sum((t) => t.totalTokens) / n),
    avgCostUsd: Number((sum((t) => t.estimatedCostUsd) / n).toFixed(5)),
  };
}
