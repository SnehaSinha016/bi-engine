// In local dev, Vite's dev-server proxy (vite.config.js) forwards
// "/api" to localhost:4000, so the relative path works with no env
// var needed. In production, frontend and backend deployed as two
// separate services (e.g. Vercel + Render), there's no such proxy,
// so VITE_API_BASE_URL must point at the deployed backend's actual
// URL. Falls back to the relative path when unset, so local dev is
// completely unaffected.
const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

async function request(path, { method = "GET", token, body, params } = {}) {
  let url = `${BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }
  // Read directly from sessionStorage (same place AuthContext persists
  // it) rather than threading a new parameter through every existing
  // api.* call site across the app, request() stays a plain function,
  // and every page automatically picks up the current Demo/My Data
  // choice without being touched.
  const dataMode = sessionStorage.getItem("bi_data_mode") || "demo";
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Data-Mode": dataMode,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  listUsers: () => request("/auth/users"),
  login: (userId) => request("/auth/login", { method: "POST", body: { userId } }),
  dashboard: (token, region) => request("/kpi/dashboard", { token, params: { region } }),
  kpiStory: (token, kpiId, region, persona) => request(`/kpi/${kpiId}/story`, { token, params: { region, persona } }),
  node: (token, kpiId, nodeId, region) => request(`/kpi/${kpiId}/node/${nodeId}`, { token, params: { region } }),
  sparseProduct: (token) => request("/kpi/sparse/new-product", { token }),
  evidence: (token, kpi, region) => request("/evidence", { token, params: { kpi, region } }),
  actions: (token, kpi, region) => request("/actions", { token, params: { kpi, region } }),
  memory: (token, region) => request("/memory", { token, params: { region } }),
  proposeScenario: (token, kpi, region) => request("/memory/propose", { method: "POST", token, body: { kpi, region } }),
  confirmScenario: (token, id, body) => request(`/memory/${id}/confirm`, { method: "POST", token, body }),
  pendingScenarios: (token) => request("/memory/pending", { token }),
  submitFeedback: (token, body) => request("/feedback", { method: "POST", token, body }),
  listFeedback: (token) => request("/feedback", { token }),
  telemetry: (token) => request("/telemetry", { token }),
  // P3, dynamic metadata, replaces hardcoded frontend arrays
  metaKpis: (token) => request("/meta/kpis", { token }),
  metaRegions: (token) => request("/meta/regions", { token }),
  metaHypotheses: (token, kpi) => request("/meta/hypotheses", { token, params: { kpi } }),
  metaPersonas: (token) => request("/meta/personas", { token }),
  // Reconciliation, driver-tree admin, confidence calibration
  reconciliation: (token) => request("/meta/reconciliation", { token }),
  driverTrees: (token) => request("/meta/driver-trees", { token }),
  driverTree: (token, kpi) => request(`/meta/driver-trees/${kpi}`, { token }),
  addDriverNode: (token, kpi, parentNodeId, node) => request(`/meta/driver-trees/${kpi}/nodes`, { method: "POST", token, body: { parentNodeId, node } }),
  editDriverNode: (token, kpi, nodeId, patch) => request(`/meta/driver-trees/${kpi}/nodes/${nodeId}`, { method: "PUT", token, body: patch }),
  deleteDriverNode: (token, kpi, nodeId) => request(`/meta/driver-trees/${kpi}/nodes/${nodeId}`, { method: "DELETE", token }),
  putDriverTree: (token, kpi, tree) => request(`/meta/driver-trees/${kpi}`, { method: "PUT", token, body: tree }),
  confidenceCalibration: (token) => request("/meta/confidence-calibration", { token }),
  aiEngineStatus: (token) => request("/meta/ai-engine-status", { token }),

  // Data ingestion (Data Management page)
  dataSources: (token) => request("/data/sources", { token }),
  dataHealth: (token) => request("/data/health", { token }),
  dataRecords: (token, table) => request("/data/records", { token, params: { table } }),
  deleteDataRecord: (token, table, id) => request(`/data/records/${table}/${id}`, { method: "DELETE", token }),
  dataBatches: (token) => request("/data/batches", { token }),
  dataBatch: (token, id) => request(`/data/batches/${id}`, { token }),
  ingestData: (token, table, records, method) => request("/data/ingest", { method: "POST", token, body: { table, records, method } }),
  csvPreview: (token, table, csvText) => request("/data/ingest/csv-preview", { method: "POST", token, body: { table, csvText } }),
};
