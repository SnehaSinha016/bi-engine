// ============================================================
// REGION MAPPING
// Live platforms don't know your internal "north/south/west"
// split. This file is the single place that maps a platform's own
// field (Shopify shipping province, a Zendesk tag) to one of your
// business regions. Edit these tables for your own org, nothing
// else in the connectors needs to change.
//
// Any value not found in a map falls back to DEFAULT_REGION, so a
// live source with no mapping configured still works (it just
// reports everything under one bucket, same as before).
// ============================================================

export const DEFAULT_REGION = "all";

// Shopify order.shipping_address.province (or province_code) -> region
export const SHOPIFY_PROVINCE_TO_REGION = {
  // Example for a US-based split, replace with your own:
  // "California": "west", "Oregon": "west", "Washington": "west",
  // "New York": "north", "Massachusetts": "north",
  // "Texas": "south", "Florida": "south",
};

export function mapShopifyRegion(order) {
  const province = order.shipping_address?.province || order.shipping_address?.province_code;
  return SHOPIFY_PROVINCE_TO_REGION[province] || DEFAULT_REGION;
}

// Zendesk ticket tag -> region. A ticket can carry multiple tags;
// the first one that matches a known region wins.
export const ZENDESK_TAG_TO_REGION = {
  // "region_north": "north", "region_south": "south", "region_west": "west",
};

export function mapZendeskRegion(ticket) {
  const tags = ticket.tags || [];
  for (const tag of tags) {
    if (ZENDESK_TAG_TO_REGION[tag]) return ZENDESK_TAG_TO_REGION[tag];
  }
  return DEFAULT_REGION;
}

// Salesforce Opportunity -> region, via a field you choose. Default
// looks for a custom field "Region__c"; adjust the SOQL query in
// salesforceProvider.js to select whatever field you actually use.
export function mapSalesforceRegion(opportunity) {
  return opportunity.Region__c || DEFAULT_REGION;
}
