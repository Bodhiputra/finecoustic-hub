export const BRAND_SLUG = 'finecoustic';
export const ACTIVE_SKUS = ['FBS1', 'FBS2'];

export const SHIPMENT_LABELS = {
  shipped: 'Shipped',
  not_shipped: 'Not yet shipped',
  preparing: 'Being prepared',
  po_listed: 'On order list',
};

const sum = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);

export function productName(ops, sku) {
  return ops.products.find(p => p.sku === sku)?.name || sku;
}

export function partnerByCode(ops, code) {
  return ops.b2b_partners.find(p => p.code === code);
}

export function allocationCountsTowardStock(ops, partnerCode) {
  const p = partnerByCode(ops, partnerCode);
  return p?.counts_toward_stock !== false;
}

/** B2B still reserved against Dongguan — not yet outbound from warehouse */
export function allocationStillReserved(ops, partnerCode) {
  const p = partnerByCode(ops, partnerCode);
  if (!p || !allocationCountsTowardStock(ops, partnerCode)) return false;
  return !(p.shipment_status === 'shipped' && p.shipment_status_confirmed);
}

export function getLedgerBaseline(ops, sku) {
  const wb = ops.warehouse_balance?.find(s => s.sku === sku);
  if (ops.meta?.stock_calc_basis === 'warehouse_balance' && wb) return wb.qty;
  return ops.initial_stock.find(s => s.sku === sku)?.qty || 0;
}

export function getManualQty(ops, sku, warehouse) {
  return ops.inventory_manual?.find(i => i.sku === sku && i.warehouse === warehouse)?.qty ?? null;
}

export function formatDate(value) {
  if (!value) return 'To be confirmed';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** DD/MM/YY for customer data freshness labels */
export function formatDataDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function customerDataUpdatedAt(ops) {
  return ops.meta?.customer_data_updated_at || '2026-05-29';
}

export function inventoryDataUpdatedAt(ops) {
  return (
    ops.meta?.inventory_data_updated_at ||
    ops.warehouse_balance?.find(s => s.as_of)?.as_of ||
    ops.inventory_manual?.find(i => i.warehouse === 'dongguan')?.as_of ||
    null
  );
}

export function shopifyDataUpdatedAt(ops) {
  return (
    ops.meta?.shopify_data_updated_at ||
    ops.inventory_manual?.find(i => i.warehouse === 'shopify')?.as_of ||
    null
  );
}

export function partnerAllocations(ops, code) {
  return ops.b2b_allocations.filter(a => a.partner_code === code);
}

export function productsOrdered(ops, code) {
  const items = partnerAllocations(ops, code).filter(a => a.qty > 0);
  if (!items.length) return '—';
  return items.map(a => `${productName(ops, a.sku)} ×${a.qty}`).join(', ');
}

function isShippedConfirmed(ops, partnerCode) {
  const p = partnerByCode(ops, partnerCode);
  return p?.shipment_status === 'shipped' && p.shipment_status_confirmed;
}

/** Warehouse bar segments vs Axia available — surfaces known ledger gaps */
export function calcStockReconciliation(ops) {
  const { metrics } = calcMetrics(ops);
  const items = ACTIVE_SKUS.map(sku => {
    const m = metrics[sku];
    const available = m.axiaAfterOrders;
    const inWarehouseAccounted =
      m.b2bReserved + m.internal + (available ?? 0);
    const inWarehouseGap = m.warehouseQty - inWarehouseAccounted;
    const calcAvailable = m.warehouseQty - m.b2bReserved - m.internal;
    const axiaDelta = available != null ? available - calcAvailable : null;
    const ledgerRemaining = m.warehouseQty - m.b2bAll - m.internal;

    return {
      sku,
      ...m,
      inWarehouseGap,
      calcAvailable,
      axiaDelta,
      ledgerRemaining,
      hasGap:
        inWarehouseGap !== 0 ||
        (axiaDelta != null && axiaDelta !== 0) ||
        ledgerRemaining < 0,
    };
  });

  return {
    items,
    hasAnyIssue: items.some(i => i.hasGap),
    totalUnaccounted: sum(items, i => Math.max(0, i.inWarehouseGap)),
  };
}

export function calcMetrics(ops) {
  const metrics = {};

  for (const sku of ACTIVE_SKUS) {
    const ledgerBaseline = getLedgerBaseline(ops, sku);
    const b2bAll = sum(
      ops.b2b_allocations.filter(a => a.sku === sku && allocationCountsTowardStock(ops, a.partner_code)),
      a => a.qty
    );
    const b2bShipped = sum(
      ops.b2b_allocations.filter(
        a => a.sku === sku && allocationCountsTowardStock(ops, a.partner_code) && isShippedConfirmed(ops, a.partner_code)
      ),
      a => a.qty
    );
    const b2bReserved = sum(
      ops.b2b_allocations.filter(a => a.sku === sku && allocationStillReserved(ops, a.partner_code)),
      a => a.qty
    );
    const internal = sum(ops.internal_use.filter(a => a.sku === sku), a => a.qty);
    const axiaAfterOrders = getManualQty(ops, sku, 'dongguan');
    metrics[sku] = {
      warehouseQty: ledgerBaseline,
      b2bAll,
      b2bShipped,
      b2bReserved,
      internal,
      axiaAfterOrders,
    };
  }

  return {
    metrics,
    warehouseTotal: sum(ACTIVE_SKUS, sku => metrics[sku].warehouseQty),
    b2bShippedTotal: sum(ACTIVE_SKUS, sku => metrics[sku].b2bShipped),
    b2bPendingTotal: sum(ACTIVE_SKUS, sku => metrics[sku].b2bReserved),
    b2bTotal: sum(
      ops.b2b_allocations.filter(a => allocationCountsTowardStock(ops, a.partner_code)),
      a => a.qty
    ),
    partnerCount: ops.b2b_partners.length,
  };
}

export function shopifyQty(shopify, ops, sku) {
  const sync = shopify?.inventory?.find(i => i.sku === sku)?.available;
  if (sync != null) return sync;
  const manual = getManualQty(ops, sku, 'shopify');
  return manual != null ? manual : null;
}

export function shipmentCounts(ops) {
  const counts = { shipped: 0, not_shipped: 0, preparing: 0, po_listed: 0 };
  for (const p of ops.b2b_partners) {
    if (counts[p.shipment_status] != null) counts[p.shipment_status] += 1;
  }
  return counts;
}

export function shipmentStatusClass(p) {
  if (p.shipment_status === 'shipped' && p.shipment_status_confirmed) return 'status-ok';
  if (p.shipment_status === 'not_shipped') return 'status-wait';
  return 'status-pending';
}
