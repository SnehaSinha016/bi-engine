import "dotenv/config";
import express from "express";
import cors from "cors";
import { loadDataset } from "./data/sources/index.js";
import { dataModeMiddleware } from "./middleware/dataMode.js";

import authRoutes from "./routes/auth.js";
import kpiRoutes from "./routes/kpi.js";
import evidenceRoutes from "./routes/evidence.js";
import actionRoutes from "./routes/action.js";
import memoryRoutes from "./routes/memory.js";
import feedbackRoutes from "./routes/feedback.js";
import telemetryRoutes from "./routes/telemetry.js";
import metaRoutes from "./routes/meta.js";
import dataRoutes from "./routes/data.js";

// P7: fail fast at boot rather than silently falling back to a
// hardcoded demo secret. Every JWT issued/verified in this process
// depends on this being a real, operator-provided value.
if (!process.env.JWT_SECRET) {
  console.error(
    "FATAL: JWT_SECRET is not set. Copy server/.env.example to server/.env and set a real JWT_SECRET before starting the server."
  );
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// Dataset is loaded once at boot from whichever DATA_SOURCE is
// configured (synthetic | csv | shopify | zendesk | blended) and
// cached in app.locals, simulates a warm BI cache. Regenerate with
// POST /api/admin/regenerate (re-runs the same DATA_SOURCE) or a
// server restart.
app.locals.dataset = await loadDataset();

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    bootedAt: new Date().toISOString(),
    dataSource: process.env.DATA_SOURCE || "synthetic",
    provenance: app.locals.dataset.provenance,
    dataSourceErrors: app.locals.dataset.dataSourceErrors || [],
  })
);

app.post("/api/admin/regenerate", async (req, res) => {
  app.locals.dataset = await loadDataset();
  res.json({ ok: true, regeneratedAt: new Date().toISOString(), provenance: app.locals.dataset.provenance });
});

app.use("/api/auth", authRoutes);
app.use("/api/kpi", dataModeMiddleware, kpiRoutes);
app.use("/api/evidence", dataModeMiddleware, evidenceRoutes);
app.use("/api/actions", dataModeMiddleware, actionRoutes);
app.use("/api/memory", dataModeMiddleware, memoryRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/meta", dataModeMiddleware, metaRoutes);
app.use("/api/data", dataRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`BI Engine API listening on http://localhost:${PORT}`);
  console.log(`Data source: ${process.env.DATA_SOURCE || "synthetic"} (regions: ${app.locals.dataset.regions.join(", ")})`);
  if (app.locals.dataset.dataSourceErrors?.length) {
    console.log(`Data source warnings: ${app.locals.dataset.dataSourceErrors.join(" | ")}`);
  }
  const providerLabel = process.env.GEMINI_API_KEY
    ? "Gemini API (live)"
    : process.env.ANTHROPIC_API_KEY
    ? "Anthropic API (live)"
    : "mock deterministic provider (no GEMINI_API_KEY or ANTHROPIC_API_KEY set)";
  console.log(`LLM provider: ${providerLabel}`);
});
