# KPI Intelligence-to-Action Engine — Prototype

An AI investigation and decision-intelligence layer on top of BI, built for the
BusinessIntelligence.ai Round 2 brief. It turns a KPI movement into a
traceable chain: materiality → driver tree → evidence → competing hypotheses
→ confidence → recommended action → persona-specific narrative → feedback.

## Round 2 upgrade: from scenario-driven demo to adaptive prototype

The prototype was evolved from a hardcoded, revenue-only demo into a
genuinely dynamic one, in priority order:

- **P0 Dynamic reasoning** — no hardcoded hypothesis list. Every leaf node
  in a KPI's driver tree (`shared/driverTrees.js`) becomes a candidate
  hypothesis automatically (`flattenHypothesisNodes` in the same file). All
  5 KPIs (Revenue, Orders, Conversion, AOV, Churn) run the full
  investigation, not just Revenue.
- **P1 Adaptive materiality** — thresholds are derived per-metric, per-region
  from that metric's own trailing volatility, combined with a static
  business-priority weight into an explainable 0–100 Materiality Score.
  Sparse history gets an explicit `UNKNOWN` state instead of a fabricated
  z-score.
- **P2 Real business memory** — `POST /api/memory/propose` snapshots a
  resolved insight; `POST /api/memory/:id/confirm` requires an analyst to
  supply the confirmed cause/action/outcome before it's searchable. Future
  historical-similarity search uses seed *and* confirmed scenarios.
- **P3 Dynamic metadata** — `/api/meta/*` endpoints (kpis, regions,
  hypotheses, personas, confidence-config) replace what used to be
  hardcoded arrays in the frontend.
- **P4 Dynamic recommendations** — `analytics/impact.js` computes real
  currency impact for conversion- and price-type drivers from actual data;
  every other driver says "Impact estimate unavailable" instead of guessing.
- **P5 Confidence** — weights configurable via env, explicit
  "not a probability of causality" disclaimer on every confidence object.
- **P6 Data correctness** — removed `productMixShift`/`segmentMixShift`
  (never backed by a real field, silently always 0) and `leads`/`promoShare`
  (scaled duplicates dressed up as distinct metrics). The one legitimate
  composite (Operational branch) is now a documented, transparent
  aggregation of its children rather than a phantom field.
- **P7 Security** — no hardcoded JWT fallback; the server refuses to boot
  without `JWT_SECRET` set.
- **P8 Telemetry** — LLM pricing is env-configurable, not hardcoded.

See "Reasoning flow" and "Known limitations" below for the full detail, and
the end of this section for exactly which files changed.

<details>
<summary><b>Files changed / added in the Round 2 upgrade</b></summary>

New:
- `server/analytics/impact.js` — P4 dynamic impact estimation
- `server/store/scenarios.js` — P2 confirmed-scenario store
- `server/routes/meta.js` — P3 metadata endpoints

Substantially rewritten:
- `server/shared/driverTrees.js` — trees for all 5 KPIs, fake nodes removed
- `server/shared/kpiContracts.js` — `materialityFloor` + `businessWeight`
  replace the old single `materialityThreshold`
- `server/shared/actionLibrary.js` — `expectedImpact` strings removed, new
  entries for previously-unmapped leaf nodes (traffic/customers/returns/cx)
- `server/analytics/engine.js` — adaptive materiality, composite metrics,
  configurable confidence weights, `leads`/`promoShare` removed
- `server/reasoning/investigate.js` — `investigateKpi()` replaces the
  revenue-only function; hypotheses generated dynamically from the tree
- `server/routes/kpi.js`, `action.js`, `evidence.js`, `memory.js` —
  generalized to any KPI via `?kpi=` query param
- `server/auth/middleware.js`, `server.js` — JWT fail-fast
- `server/llm/provider.js`, `narrative.js` — configurable pricing, dynamic
  impact in prompts
- `client/src/pages/KpiStory.jsx` — works for all 5 KPIs, shows Materiality
  Score breakdown, "Propose to Business Memory" button
- `client/src/pages/DriverTree.jsx`, `ActionCenter.jsx`,
  `EvidenceExplorer.jsx` — KPI selector added
- `client/src/pages/Feedback.jsx`, `HistoricalMemory.jsx`,
  `components/Sidebar.jsx` — dynamic metadata instead of hardcoded arrays;
  HistoricalMemory adds the pending-confirmation review UI
- `client/src/lib/api.js` — new endpoints wired

Unchanged (P0–P8 didn't need to touch these): `data/generate.js`,
`data/sources/*` (Shopify/Zendesk/Salesforce/CSV connectors), `auth/users.js`,
`store/db.js`, `routes/auth.js`, `routes/feedback.js`, `routes/telemetry.js`,
overall folder structure and API base paths.
</details>

## Running it locally

Two processes, no external database required (data is generated in-memory on
boot with a fixed seed; feedback/telemetry/confirmed-scenarios persist to
small JSON files under `server/.store/`).

**Required first step:** copy `server/.env.example` to `server/.env` and set
a real `JWT_SECRET` — the server now refuses to boot without one (P7, no
hardcoded fallback).

```bash
# Terminal 1 — API
cd server
cp .env.example .env   # then edit .env and set JWT_SECRET
npm install
npm start          # http://localhost:4000

# Terminal 2 — UI
cd client
npm install
npm run dev         # http://localhost:5173 (proxies /api to :4000)
```

No LLM API key is required — the app boots with a deterministic mock LLM
provider. To use a real model for the narrative layer, set `ANTHROPIC_API_KEY`
before starting the server; the provider interface (`server/llm/provider.js`)
swaps automatically.

## Data sources — synthetic, real CSV/Excel export, or live APIs

The app no longer only runs on the in-memory synthetic generator. Data
ingestion is a pluggable layer (`server/data/sources/`), selected with the
`DATA_SOURCE` env var (copy `server/.env.example` to `server/.env`):

| `DATA_SOURCE` | What it does | Setup |
|---|---|---|
| `synthetic` (default) | Deterministic in-memory generator, same as before | none |
| `csv` | Reads real files from `server/data/csv/*.csv` | none — files are already exported (see below) |
| `shopify` | Real orders/revenue/discounts/refunds from the Shopify Admin API, plus a real checkout-success proxy from abandoned checkouts | `SHOPIFY_SHOP`, `SHOPIFY_ACCESS_TOKEN` |
| `zendesk` | Real support tickets from the Zendesk API, with deterministic (non-LLM) category/sentiment classification | `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_TOKEN` |
| `blended` | Shopify for ERP + Zendesk for support + Salesforce (optional) for a churn signal, all overlaid onto the synthetic scaffold for any field none of them provide | any combination of the above |

**Honesty about provenance is a first-class feature, not an afterthought.**
Every dataset carries a `provenance` object (`{ erp, crm, support }`) saying
exactly which source each domain came from, and for blended mode, exactly
which *fields* are live vs. synthetic-fallback (e.g. `"shopify (live: orders,
revenue, aov, discountRate, refundsRate, checkoutSuccessRate) + synthetic
overlay for traffic, conversion, stockoutRate, ..."`). `GET /api/health`
returns it, and the Executive Dashboard shows a "Live data connected" /
"CSV file data" / "Synthetic demo data" badge sourced from the same field —
nothing in the UI claims a number is measured when it was actually filled in.

None of Shopify, Zendesk, or Salesforce natively provide every field the
driver tree wants (e.g. no e-commerce platform hands you "SLA breach rate"
or "customer sentiment" — those require your own instrumentation or a
support desk). The composer (`server/data/sources/index.js`) overlays real
values onto the synthetic scaffold field-by-field rather than replacing the
whole row, so the reasoning engine always has a complete row to work with,
and never hides which parts are real.

Live connectors group by your real regions if you tell them how — one edit
in `server/data/sources/regionMap.js`:

```js
// server/data/sources/regionMap.js
export const SHOPIFY_PROVINCE_TO_REGION = {
  "California": "west", "Oregon": "west",
  "New York": "north", "Massachusetts": "north",
  "Texas": "south", "Florida": "south",
};
export const ZENDESK_TAG_TO_REGION = {
  "region_north": "north", "region_south": "south", "region_west": "west",
};
```

Once populated, Shopify orders and Zendesk tickets are grouped by your real
regions instead of one flat `"all"` bucket, and `GET /api/health` /
`provenance.erp` will say `"mapped to regions: north, south, west"` instead
of `"unmapped"` so you can confirm it took effect. Leave a table empty and
that source safely falls back to the single-bucket behavior — nothing
breaks either way.

### Real CSV/Excel export

`server/data/csv/` already contains a real, non-synthetic-*in the sense of
generated-on-the-fly* export you can open directly:

- `erp.csv`, `crm.csv`, `support.csv`, `historical_scenarios.csv`,
  `new_product.csv` — one file per domain, plain CSV
- `bi_engine_export.xlsx` — the same data as a formatted, multi-sheet Excel
  workbook (one tab per domain, frozen header row, autofilter, column widths
  sized to content)

These were exported once from the synthetic generator as a **starting
schema** — replace the contents of any CSV with your own real exports (same
column headers) and set `DATA_SOURCE=csv` to run the whole reasoning engine
against them. The CSV provider (`server/data/sources/csvProvider.js`) reads
file modification time for real freshness reporting, and derives
`complaintRate` directly from ticket counts in `support.csv` rather than
trusting a stored column, so it can't silently drift from the ticket data.

### Connecting a live API in practice

1. Create API credentials on the platform (Shopify custom app with
   `read_orders`/`read_checkouts` scopes; Zendesk API token; Salesforce
   Connected App with the username-password OAuth flow enabled).
2. Copy `server/.env.example` → `server/.env`, fill in the relevant block.
3. Set `DATA_SOURCE=shopify` (or `zendesk`, or `blended`).
4. `npm start` — check the boot log line `Data source: ... ` and
   `GET /api/health` for `dataSourceErrors` if a call failed (the app never
   crashes on a connector failure, it logs the error and falls back to the
   synthetic value for that field).

## Folder structure

```
server/
  data/
    csv/           real CSV + Excel exports (starting schema — replace with
                    your own data and set DATA_SOURCE=csv)
    sources/       pluggable data-source providers: synthetic, csv, Shopify,
                    Zendesk, Salesforce, and the composer that blends them
    generate.js    the original synthetic generator (used as scaffold/fallback)
  shared/        KPI semantic contracts, driver tree definition, action library
  analytics/     deterministic engine: materiality, trend, anomaly, contribution,
                 confidence, historical scenario similarity — NO LLM calls
  reasoning/     investigation engine: tree traversal, hypothesis ranking,
                 ambiguity/novelty/abstention decisions
  llm/           provider interface (mock + real Anthropic), prompt building —
                 the ONLY place LLM calls happen
  auth/          JWT issuing + RBAC/row-level region filtering middleware
  store/         JSON-file backed feedback + telemetry + confirmed-scenario store
  routes/        Express routes per page/concern
client/
  src/pages/     one file per UI page (see below)
  src/components/ Sidebar (persona/region switcher), ConfidenceRing, Badge
  src/context/   AuthContext (session, persona, region)
  src/lib/api.js thin fetch wrapper
```

## LLM vs non-LLM (the mandatory separation)

Every number in the app — revenue, % change, z-score, anomaly score,
contribution %, historical similarity, confidence score, materiality score,
estimated currency impact, RBAC decisions — is computed in
`analytics/engine.js`, `analytics/impact.js`, or `reasoning/investigate.js`
with plain arithmetic. The LLM (`llm/narrative.js` → `llm/provider.js`)
receives a compact, pre-computed fact sheet (`buildPrompt`) and is only
allowed to turn it into persona-appropriate prose. It cannot invent
hypotheses (they're generated from whichever KPI's driver tree is
configured in `shared/driverTrees.js` — see Reasoning flow below), cannot
invent actions (they come from `shared/actionLibrary.js`), cannot invent a
currency impact (from `analytics/impact.js`, or explicitly "unavailable"),
and cannot alter numbers — the mock provider even demonstrates this by
template-filling rather than "reasoning" at all, and still produces
coherent, correct output, since all the reasoning already happened
upstream.

## Reasoning flow

Works identically for all 5 KPIs (Revenue, Orders, Conversion, AOV, Churn)
— `investigateKpi(dataset, kpiId, region, persona)` is the single entry
point, no per-KPI special-casing.

1. `materialityCheck` — is this move big enough *and* statistically
   significant to investigate at all? The threshold is **adaptive**: derived
   from this metric's own trailing coefficient of variation
   (`computeAdaptiveThreshold`), floored by a small per-KPI config value,
   combined with a static business-priority weight into an explainable
   0–100 Materiality Score. Under 10 days of baseline history, this returns
   an explicit `UNKNOWN` state rather than a fabricated z-score.
2. `buildDriverTreeIntelligence` — compute current value, baseline, %
   change, z-score, trend, volatility, anomaly score, and materiality for
   every node in the KPI's own driver tree. One branch (Operational, under
   Revenue) is a composite with no single real field — its value is a
   documented, transparent standardized average of its children
   (`computeCompositeMetrics`), not a phantom field.
3. `generateHypotheses` — **no hardcoded list.** `flattenHypothesisNodes`
   walks the KPI's driver tree and turns every leaf node into a candidate
   hypothesis automatically. Each is scored on anomaly strength,
   support-ticket evidence, historical similarity (only applied to the
   hypothesis whose driver text actually matches — never uniformly), data
   quality, temporal alignment, and any analyst feedback penalty.
4. Decision logic: if the top two hypotheses are within 8 confidence points
   of each other → `AMBIGUOUS` (abstain, ask for more evidence). If the top
   hypothesis is `HIGH` confidence → `RECOMMEND_ACTION`. If `MEDIUM` →
   `INVESTIGATE_DEEPER`. Otherwise → abstain/monitor.
5. `matchHistoricalScenarios` — Euclidean similarity (not just cosine/
   direction) over a 5-dimension scenario fingerprint, searched over **both**
   the seed incident library and any analyst-confirmed scenarios (P2 —
   `store/scenarios.js`). Below the threshold → `NOVEL PATTERN`.
6. `estimateImpact` — for the top hypothesis, computes real currency impact
   where a reliable formula exists (conversion-type and price-type
   drivers); every other driver explicitly returns "Impact estimate
   unavailable."
7. `narrateInsight` — the only LLM call — turns all of the above into an
   executive or operations-manager narrative.

## Business memory

Seed historical scenarios stay as curated starting data
(`dataset.historicalScenarios`). New scenarios accumulate via a two-step,
human-in-the-loop flow:

1. `POST /api/memory/propose` — snapshot a resolved insight (KPI state/
   fingerprint, driver tree summary, hypotheses, evidence, persona,
   timestamp) as `pending_confirmation`. Anyone can propose.
2. `POST /api/memory/:id/confirm` — an analyst/business user supplies
   `confirmedCause`, `actionTaken`, and `outcome` (all required — the
   request is rejected without them). Only then does the scenario become
   eligible for future historical-similarity search, merged with the seed
   library in `matchHistoricalScenarios`.

Historical similarity — seed or confirmed — is never presented as proof of
causality, in the API messages or the LLM system prompt.

## Demo scenarios (all live in the running prototype)

| # | Scenario | Where |
|---|----------|-------|
| 1 | Known historical pattern (checkout/payment disruption) | Revenue → North |
| 2 | Novel pattern (fulfillment/supply disruption, no match) | Revenue → South |
| 3 | Ambiguous (competing hypotheses, system abstains) | Revenue → West |
| 4 | Sparse history (new product, <14 days) | "New Product (sparse)" page |
| 5 | Security / RBAC | Switch persona in the sidebar: executive sees all regions aggregated, a Regional Manager is 403'd outside their region, Analyst sees raw ticket text others don't |
| 6 | Dynamic reasoning across all 5 KPIs | Dashboard → click any KPI card (Orders/Conversion/AOV/Churn now get the full investigation, not just Revenue) |
| 7 | Real business memory | KPI Story → "Propose to Business Memory" → Business Memory page → confirm with cause/action/outcome → re-run the same KPI/region and see it rank in future similarity search |

Suggested walkthrough: sign in as **VP, Revenue** (executive) → Dashboard →
click any KPI card → KPI Story (shows Materiality Score breakdown, dynamic
hypotheses, and — where computable — a real currency impact estimate) →
Driver Tree (pick a different KPI from the selector) → Evidence Explorer →
Action Center → Business Memory (propose + confirm a scenario) → switch
region to South (novel pattern) → switch to West (ambiguous) → visit "New
Product (sparse)" → switch persona to **Regional Manager — North** and try
changing region to South (blocked) → Feedback (now KPI-aware) → Telemetry.

## Known limitations / what's next for production

- Data is regenerated fresh (same seed) on every server restart in
  synthetic mode; there's no real persistence layer (Mongo/Postgres) —
  feedback/telemetry/confirmed-scenarios are flat JSON files, fine for a
  demo, not for concurrent multi-user production use.
- The confidence model's weights are env-configurable and documented, but
  still hand-set defaults, not learned; a production version would
  calibrate them against outcome data captured through the feedback loop
  and the now-accumulating confirmed-scenario history.
- Analyst feedback nudges future confidence scores by a fixed penalty; there
  is no real model retraining, as scoped.
- RAG/embeddings for the historical scenario matcher is currently a
  deterministic fingerprint distance over seed + confirmed scenarios rather
  than a real vector store — swappable behind the same
  `matchHistoricalScenarios` interface.
- No real authentication provider (Firebase/OAuth) — JWT issuance is a demo
  stand-in keyed off a fixed user list.
- Live connectors (Shopify/Zendesk) aggregate into a single region bucket
  by default, until you fill in `server/data/sources/regionMap.js` (Shopify
  province, Zendesk tag) — see the "Data sources" section above. Salesforce
  region mapping needs a SOQL field added too (see comment in
  `salesforceProvider.js`), since most orgs don't have a region field on
  Opportunity by default.
- Salesforce uses the username-password OAuth flow for prototype speed;
  production should move to the JWT Bearer flow (same `soql()` call, just
  swap how `access_token` is obtained).
- Dynamic impact estimation (P4) covers conversion-type and price-type
  drivers only — the two cases with a reliable, non-speculative formula
  from the data this prototype has. Fulfillment, delivery, complaints,
  churn, and sentiment-type drivers correctly report "Impact estimate
  unavailable" rather than a fabricated number — extending this needs more
  data (e.g. order-level, churn-adjusted LTV) than the current ERP/CRM
  export carries.
- The Operational branch's composite metric (`computeCompositeMetrics`) is
  a documented, transparent standardized average of its children — a
  reasonable, inspectable aggregation, but still a modeling choice, not a
  measured field. It exists only for tree-display/contribution-rollup
  purposes; no hypothesis or action is ever generated from it directly
  (hypotheses only come from leaf nodes).
- Untested against live Shopify/Zendesk/Salesforce accounts in this
  environment (sandboxed, no outbound access to those domains) — the
  request/response shapes match each platform's documented REST API, but
  verify against your own account before relying on it.
