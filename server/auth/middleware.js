import jwt from "jsonwebtoken";
import { findUser } from "./users.js";

// P7: no hardcoded fallback. The server refuses to issue or verify
// tokens without a real secret configured, see server.js boot check,
// which fails fast at startup rather than letting this throw lazily
// on the first request.
const JWT_SECRET = process.env.JWT_SECRET;

export function issueToken(userId) {
  const user = findUser(userId);
  if (!user) return null;
  return jwt.sign({ sub: user.id, role: user.role, regionScope: user.regionScope }, JWT_SECRET, { expiresIn: "12h" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUser(payload.sub);
    if (!user) return res.status(401).json({ error: "Unknown user" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Row-level filtering: a "manager" may only query their own assigned
// region. An "executive" or "analyst" may query any region. This is
// enforced server-side, never trust the client's requested region.
export function regionGuard(req, res, next) {
  const requested = req.query.region || req.body?.region;
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  if (user.regionScope !== "all") {
    if (requested && requested !== user.regionScope) {
      return res.status(403).json({
        error: `Access denied: ${user.title} is scoped to the ${user.regionScope} region only.`,
      });
    }
    req.effectiveRegion = user.regionScope;
  } else {
    req.effectiveRegion = requested || "all";
  }
  next();
}

// Analysts see detailed/raw data (ticket text, lineage); execs and
// managers see aggregated/summarized views only.
export function canSeeDetail(user) {
  return user.dataDetail === "detailed";
}
