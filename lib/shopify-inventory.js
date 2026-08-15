/**
 * Shopify Admin API — inventory read/write for Ops stock sync.
 * Requires SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN (read_inventory, write_inventory).
 */

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

function shopifyConfig() {
  const token = (process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
  const store = (process.env.SHOPIFY_STORE || '').trim();
  if (!token || !store) return null;
  return { token, store };
}

export function isShopifyInventoryConfigured() {
  return Boolean(shopifyConfig());
}

function adminHeaders(token) {
  return {
    'X-Shopify-Access-Token': token,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function adminFetch(path, { method = 'GET', body } = {}) {
  const config = shopifyConfig();
  if (!config) {
    const err = new Error('shopify_not_configured');
    err.status = 503;
    throw err;
  }

  const url = `https://${config.store}/admin/api/${API_VERSION}${path}`;
  const response = await fetch(url, {
    method,
    headers: adminHeaders(config.token),
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    const err = new Error(`shopify_api_${response.status}`);
    err.status = response.status === 401 || response.status === 403 ? 502 : 502;
    err.detail = detail.slice(0, 400);
    throw err;
  }

  if (response.status === 204) return null;
  return response.json();
}

let cachedLocationId = null;

export async function getPrimaryLocationId() {
  if (cachedLocationId) return cachedLocationId;
  const data = await adminFetch('/locations.json');
  const locations = data?.locations || [];
  const active = locations.find(l => l.active) || locations[0];
  if (!active?.id) {
    const err = new Error('shopify_no_location');
    err.status = 502;
    throw err;
  }
  cachedLocationId = active.id;
  return cachedLocationId;
}

/** Find variant + inventory item by SKU (GraphQL). */
export async function findVariantBySku(sku) {
  const config = shopifyConfig();
  if (!config) return null;

  const query = `
    query VariantBySku($q: String!) {
      productVariants(first: 5, query: $q) {
        edges {
          node {
            id
            sku
            inventoryQuantity
            inventoryItem { id }
          }
        }
      }
    }
  `;

  const url = `https://${config.store}/admin/api/${API_VERSION}/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: adminHeaders(config.token),
    body: JSON.stringify({
      query,
      variables: { q: `sku:${String(sku).trim()}` },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const err = new Error(`shopify_graphql_${response.status}`);
    err.status = 502;
    throw err;
  }

  const payload = await response.json();
  const edges = payload?.data?.productVariants?.edges || [];
  const match =
    edges.find(e => String(e.node?.sku || '').trim().toUpperCase() === String(sku).trim().toUpperCase())
      ?.node
    || edges[0]?.node;

  if (!match?.inventoryItem?.id) return null;

  const inventoryItemId = String(match.inventoryItem.id).replace('gid://shopify/InventoryItem/', '');
  const variantGid = String(match.id);

  return {
    sku: match.sku || sku,
    variant_id: variantGid,
    inventory_item_id: Number(inventoryItemId),
    available: match.inventoryQuantity ?? null,
  };
}

export async function getInventoryAvailable(inventoryItemId, locationId) {
  const data = await adminFetch(
    `/inventory_levels.json?inventory_item_ids=${inventoryItemId}&location_ids=${locationId}`
  );
  const level = (data?.inventory_levels || [])[0];
  return level?.available ?? null;
}

export async function setInventoryAvailable(inventoryItemId, locationId, available) {
  await adminFetch('/inventory_levels/set.json', {
    method: 'POST',
    body: {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: Math.max(0, Math.floor(Number(available) || 0)),
    },
  });
}

export async function pullInventoryForSkus(skus = []) {
  const locationId = await getPrimaryLocationId();
  const syncedAt = new Date().toISOString();
  const inventory = [];

  for (const sku of skus) {
    const variant = await findVariantBySku(sku);
    if (!variant) {
      inventory.push({ sku, available: null, error: 'variant_not_found' });
      continue;
    }
    let available = variant.available;
    if (available == null) {
      available = await getInventoryAvailable(variant.inventory_item_id, locationId);
    }
    inventory.push({
      sku,
      available,
      variant_id: variant.variant_id,
      inventory_item_id: variant.inventory_item_id,
    });
  }

  return { inventory, synced_at: syncedAt, location_id: locationId };
}

export async function pushInventoryForSkus(items = []) {
  const locationId = await getPrimaryLocationId();
  const syncedAt = new Date().toISOString();
  const results = [];

  for (const { sku, quantity } of items) {
    const variant = await findVariantBySku(sku);
    if (!variant) {
      results.push({ sku, ok: false, error: 'variant_not_found' });
      continue;
    }
    const target = Math.max(0, Math.floor(Number(quantity) || 0));
    await setInventoryAvailable(variant.inventory_item_id, locationId, target);
    const after = await getInventoryAvailable(variant.inventory_item_id, locationId);
    results.push({
      sku,
      ok: true,
      requested: target,
      available: after,
      variant_id: variant.variant_id,
      inventory_item_id: variant.inventory_item_id,
    });
  }

  return { results, synced_at: syncedAt, location_id: locationId };
}
