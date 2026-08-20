import { ACTIVE_SKUS, axiaAvailableQty } from '@/lib/ops';
import { getOpsData, saveOpsData } from '@/lib/data';
import {
  isShopifyInventoryConfigured,
  pullInventoryForSkus,
  pushInventoryForSkus,
} from '@/lib/shopify-inventory';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function setManualQty(ops, sku, warehouse, qty, notes = '') {
  ops.inventory_manual = ops.inventory_manual || [];
  const row = ops.inventory_manual.find(i => i.sku === sku && i.warehouse === warehouse);
  const asOf = todayIsoDate();
  if (row) {
    row.qty = qty;
    row.as_of = asOf;
    if (notes) row.notes = notes;
  } else {
    ops.inventory_manual.push({ sku, warehouse, qty, as_of: asOf, notes });
  }
}

function setProductVariantId(ops, sku, variantId) {
  if (!variantId) return;
  const product = ops.products?.find(p => p.sku === sku);
  if (product) product.shopify_variant_id = variantId;
}

function appendMovement(ops, { sku, qty, warehouse, reference }) {
  ops.movements = ops.movements || [];
  ops.movements.push({
    id: `mov-${Date.now()}-${sku}`,
    date: todayIsoDate(),
    sku,
    qty,
    warehouse,
    direction: 'adjustment',
    reason: 'shopify_sync',
    reference,
  });
}

export async function pullShopifyIntoOps(actorName = '') {
  const ops = await getOpsData();
  const { inventory, synced_at } = await pullInventoryForSkus(ACTIVE_SKUS);

  for (const row of inventory) {
    if (row.available == null || row.error) continue;
    setManualQty(ops, row.sku, 'shopify', row.available, `Pulled from Shopify by ${actorName || 'Fine Teams'}`);
    setProductVariantId(ops, row.sku, row.variant_id);
  }

  ops.meta = ops.meta || {};
  ops.meta.shopify_data_updated_at = synced_at.slice(0, 10);

  const saved = await saveOpsData(ops);
  return {
    ops: saved,
    inventory,
    synced_at,
  };
}

export async function pushAxiaAvailableToShopify(actorName = '') {
  const ops = await getOpsData();
  const items = ACTIVE_SKUS.map(sku => ({
    sku,
    quantity: axiaAvailableQty(ops, sku),
  })).filter(item => item.quantity != null);

  if (!items.length) {
    const err = new Error('no_axia_quantities');
    err.status = 400;
    throw err;
  }

  const { results, synced_at } = await pushInventoryForSkus(items);

  for (const row of results) {
    if (!row.ok) continue;
    setManualQty(
      ops,
      row.sku,
      'shopify',
      row.available ?? row.requested,
      `Pushed from Axia available by ${actorName || 'Fine Teams'}`
    );
    setProductVariantId(ops, row.sku, row.variant_id);
    appendMovement(ops, {
      sku: row.sku,
      qty: row.available ?? row.requested,
      warehouse: 'shopify',
      reference: `Shopify sync — set to Axia available (${row.requested})`,
    });
  }

  ops.meta = ops.meta || {};
  ops.meta.shopify_data_updated_at = synced_at.slice(0, 10);

  const saved = await saveOpsData(ops);
  return {
    ops: saved,
    results,
    synced_at,
  };
}

export { isShopifyInventoryConfigured };
