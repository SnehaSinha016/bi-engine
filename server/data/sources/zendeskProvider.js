// ============================================================
// ZENDESK CONNECTOR (real REST API, not a mock)
// Requires env vars:
//   ZENDESK_SUBDOMAIN   e.g. "mycompany" (mycompany.zendesk.com)
//   ZENDESK_EMAIL       the agent/admin email used for API auth
//   ZENDESK_API_TOKEN   API token (Admin Center → Apps and
//                       integrations → Zendesk API → Token Access)
//
// Zendesk gives us real ticket volume, subject/description text,
// and priority/satisfaction signals. It has no built-in "category"
// matching our driver tree (payment / delivery / fulfillment /
// product / complaint), so category is classified with a simple,
// transparent keyword rule below, deterministic, not an LLM call,
// and easy to replace with your own Zendesk custom field/tag if
// you tag tickets on creation. Region is mapped from ticket tags ,
// see regionMap.js to configure your own tag -> region table.
// ============================================================

import { mapZendeskRegion } from "./regionMap.js";

const CATEGORY_KEYWORDS = {
  payment: ["payment", "charge", "checkout", "gateway", "card declined", "billing"],
  delivery: ["delivery", "shipping", "tracking", "courier", "late", "not arrived"],
  fulfillment: ["warehouse", "stock", "out of stock", "backorder", "fulfillment"],
  complaint: ["frustrated", "angry", "worse", "unacceptable", "cancel my"],
  product: ["defect", "broken", "quality", "return policy", "wrong item"],
};

function classifyCategory(text) {
  const lower = (text || "").toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return "other";
}

// Deterministic sentiment proxy from real Zendesk signals, never
// an LLM guess. CSAT rating wins when present; otherwise priority
// and status give a coarse but defensible estimate.
function sentimentFromTicket(t) {
  if (t.satisfaction_rating?.score === "good") return 0.6;
  if (t.satisfaction_rating?.score === "bad") return -0.7;
  const priorityScore = { urgent: -0.7, high: -0.5, normal: -0.1, low: 0.1 }[t.priority] ?? -0.1;
  return t.status === "solved" || t.status === "closed" ? priorityScore + 0.2 : priorityScore;
}

async function zendeskGet(subdomain, email, apiToken, path) {
  const auth = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
  const res = await fetch(`https://${subdomain}.zendesk.com/api/v2${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Zendesk API error ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

export async function fetchZendeskTickets({ subdomain, email, apiToken, days = 30 }) {
  if (!subdomain || !email || !apiToken) {
    throw new Error("Zendesk: ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, and ZENDESK_API_TOKEN are required");
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let path = `/search.json?query=${encodeURIComponent(`type:ticket created>${since.slice(0, 10)}`)}`;
  const tickets = [];
  let page = 0;
  while (path && page < 20) {
    const data = await zendeskGet(subdomain, email, apiToken, path);
    tickets.push(...(data.results || []));
    path = data.next_page ? data.next_page.replace(`https://${subdomain}.zendesk.com/api/v2`, "") : null;
    page++;
  }

  const mapped = tickets.map((t) => ({
    ticketId: `ZD-${t.id}`,
    date: (t.created_at || "").slice(0, 10),
    region: mapZendeskRegion(t),
    customerId: `REQ-${t.requester_id}`,
    category: classifyCategory(`${t.subject} ${t.description}`),
    issue: t.subject,
    sentiment: Number(sentimentFromTicket(t).toFixed(2)),
    freeText: t.description,
  }));

  const regionsSeen = [...new Set(mapped.map((t) => t.region))];

  return {
    tickets: mapped,
    regionsSeen,
    meta: { lastUpdatedMs: Date.now(), cadence: "live (Zendesk API)" },
  };
}
