import { mulberry32 } from "../rng.js";

// ============================================================
// SOURCE 3, SUPPORT (ticket grain, its own naming: region_label
// = "north-region" | "south-region" | "west-region", yet another
// different string/format than ERP's "N" or CRM's "North".)
//
// customer_id is INTENTIONALLY only ~80% resolvable against the
// CRM roster, the rest use a visibly different ID shape
// ("GUEST-xxxxx"), simulating real support-desk reality where some
// tickets come from guest checkouts / unauthenticated contacts with
// no CRM record. This is what makes reconciliation meaningful
// rather than a guaranteed 100% match.
// ============================================================

const REGION_LABEL = { north: "north-region", south: "south-region", west: "west-region" };

const CATEGORY_TEXT = {
  north: [
    ["payment", "Payment failed at checkout, card charged but order not confirmed", -0.8],
    ["payment", "Getting a gateway timeout error on checkout page", -0.75],
    ["complaint", "Frustrated, tried to pay three times and it kept failing", -0.85],
  ],
  south: [
    ["delivery", "Order still not shipped, tracking hasn't updated in 5 days", -0.7],
    ["delivery", "Item shows out of stock after I already paid for it", -0.72],
    ["fulfillment", "Warehouse delay pushed my delivery window back a week", -0.68],
  ],
  west: [
    ["delivery", "Delivery is taking longer than usual this week", -0.5],
    ["product", "Considering cancelling my subscription, service feels slower lately", -0.6],
    ["complaint", "Support response time has gotten worse recently", -0.55],
  ],
};
const GENERIC_TEXT = [
  ["product", "Question about return policy for electronics", 0.1],
  ["other", "Loved the new packaging, nice touch", 0.6],
  ["product", "Asking about restock date for a home goods item", -0.1],
];

export function buildSupportRaw(dailyTargetsByRegion, crmCustomers, dates) {
  const rand = mulberry32(271828);
  const custByRegionName = {};
  for (const c of crmCustomers) {
    (custByRegionName[c.region_name] ||= []).push(c.customer_id);
  }
  const REGION_NAME = { north: "North", south: "South", west: "West" };

  const tickets = [];
  let ticketSeq = 10000;

  for (const region of Object.keys(dailyTargetsByRegion)) {
    const label = REGION_LABEL[region];
    const roster = custByRegionName[REGION_NAME[region]] || [];
    const dayCount = 30;
    for (let i = 0; i < dayCount; i++) {
      const dayIdx = dates.length - 1 - Math.floor(rand() * (i < dayCount * 0.6 ? 4 : 20));
      const date = dates[Math.max(0, dayIdx)];
      const pool = rand() < 0.75 ? CATEGORY_TEXT[region] : GENERIC_TEXT;
      const [category, issue, sentiment] = pool[Math.floor(rand() * pool.length)];

      // ~80% of tickets resolve to a real CRM customer; the rest are
      // guest/unauthenticated contacts with no CRM record at all.
      const isMatched = rand() < 0.8 && roster.length > 0;
      const customer_id = isMatched
        ? roster[Math.floor(rand() * roster.length)]
        : `GUEST-${Math.floor(rand() * 900000 + 100000)}`;

      tickets.push({
        ticket_id: `TCK-${ticketSeq++}`,
        customer_id,
        region_label: label,
        timestamp: `${date}T${String(8 + Math.floor(rand() * 10)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00Z`,
        category,
        sentiment: Number(sentiment.toFixed(2)),
        issue_text: issue,
      });
    }
  }
  return tickets;
}
