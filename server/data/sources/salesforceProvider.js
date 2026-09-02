// ============================================================
// SALESFORCE CONNECTOR (real OAuth2 + SOQL, not a mock)
//
// Uses the username-password OAuth flow because it needs no
// redirect UI and is the fastest way to get a working prototype
// against your own org. It IS a legacy flow Salesforce still
// supports for most orgs (unless your org enforces the JWT Bearer
// flow only), swap fetchSalesforceToken() for a JWT Bearer
// assertion in production; nothing else in this file would change.
//
// Requires env vars:
//   SF_LOGIN_URL        e.g. "https://login.salesforce.com" (or
//                        your "https://<mydomain>.my.salesforce.com")
//   SF_CLIENT_ID         Connected App consumer key
//   SF_CLIENT_SECRET     Connected App consumer secret
//   SF_USERNAME          integration user's username
//   SF_PASSWORD          integration user's password + security token
//                        concatenated (Salesforce convention)
//
// Maps Opportunities to a churn-like signal: Closed Lost
// opportunities in the trailing window / total Closed opportunities
// in the same window. This is a reasonable proxy, not a canonical
// churn definition, replace the SOQL below with your own object
// (e.g. a custom Churn_Event__c) if you track it directly.
// ============================================================

async function fetchSalesforceToken({ loginUrl, clientId, clientSecret, username, password }) {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
  });
  const res = await fetch(`${loginUrl}/services/oauth2/token`, { method: "POST", body });
  if (!res.ok) throw new Error(`Salesforce auth error ${res.status}: ${await res.text()}`);
  return res.json(); // { access_token, instance_url, ... }
}

async function soql(instanceUrl, accessToken, query) {
  const url = `${instanceUrl}/services/data/v60.0/query/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Salesforce query error ${res.status}: ${await res.text()}`);
  return res.json();
}

// If you track region on Opportunity (e.g. a custom Region__c field
// or via Account.BillingState), add it to the SELECT below and map
// it in regionMap.js -> mapSalesforceRegion(). Left out of the
// default SOQL query since most orgs don't have this field yet.

export async function fetchSalesforceCrm({ loginUrl, clientId, clientSecret, username, password, days = 30 }) {
  if (!loginUrl || !clientId || !clientSecret || !username || !password) {
    throw new Error(
      "Salesforce: SF_LOGIN_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, and SF_PASSWORD are required"
    );
  }

  const { access_token, instance_url } = await fetchSalesforceToken({ loginUrl, clientId, clientSecret, username, password });

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const query = `SELECT Id, StageName, CloseDate, Amount FROM Opportunity WHERE CloseDate >= ${since.slice(0, 10)} AND IsClosed = true`;
  const result = await soql(instance_url, access_token, query);

  const byDate = new Map();
  for (const opp of result.records || []) {
    const date = opp.CloseDate;
    if (!byDate.has(date)) byDate.set(date, { closedLost: 0, closedTotal: 0 });
    const bucket = byDate.get(date);
    bucket.closedTotal += 1;
    if (opp.StageName === "Closed Lost") bucket.closedLost += 1;
  }

  const rows = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, b]) => ({ date, region: "all", churnRate: b.closedTotal ? b.closedLost / b.closedTotal : 0 }));

  return {
    rows,
    providedFields: ["churnRate"],
    missingFields: ["activeCustomers", "sentimentScore"],
    meta: { lastUpdatedMs: Date.now(), cadence: "live (Salesforce SOQL)" },
  };
}
