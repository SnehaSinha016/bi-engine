// ============================================================
// DATA MODE MIDDLEWARE
//
// Reads an optional X-Data-Mode header ("demo" | "userdata" |
// "combined") and attaches the correct dataset to req.activeDataset.
// When the header is absent, which is every existing caller that
// predates this feature, this resolves to exactly app.locals.dataset,
// the same cached demo dataset every route already used directly.
// Existing behavior is unchanged unless a client explicitly opts in.
// ============================================================

import { loadDatasetForMode } from "../data/sources/index.js";

export function dataModeMiddleware(req, res, next) {
  const mode = (req.headers["x-data-mode"] || "demo").toLowerCase();
  req.dataMode = mode;
  req.activeDataset = loadDatasetForMode(mode, req.app.locals.dataset);
  next();
}
