const BRAND_SLUG = 'finecoustic';
const ACTIVE_SKUS = ['FBS1', 'FBS2'];

let state = { ops: null, shopify: null };

const sum = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);

const SHIPMENT_LABELS = {
  shipped: 'Shipped',
  not_shipped: 'Not yet shipped',
  preparing: 'Being prepared',
  po_listed: 'On order list',
};

function productName(ops, sku) {
  return ops.products.find(p => p.sku === sku)?.name || sku;
}

function partnerByCode(ops, code) {
  return ops.b2b_partners.find(p => p.code === code);
}

function allocationCountsTowardStock(ops, partnerCode) {
  const p = partnerByCode(ops, partnerCode);
  return p?.counts_toward_stock !== false;
}

function getLedgerBaseline(ops, sku) {
  const wb = ops.warehouse_balance?.find(s => s.sku === sku);
  if (ops.meta?.stock_calc_basis === 'warehouse_balance' && wb) return wb.qty;
  return ops.initial_stock.find(s => s.sku === sku)?.qty || 0;
}

function getManualQty(ops, sku, warehouse) {
  return ops.inventory_manual?.find(i => i.sku === sku && i.warehouse === warehouse)?.qty ?? null;
}

function setManualQty(ops, sku, warehouse, qty) {
  ops.inventory_manual = ops.inventory_manual || [];
  const row = ops.inventory_manual.find(i => i.sku === sku && i.warehouse === warehouse);
  const today = new Date().toISOString().slice(0, 10);
  if (row) {
    row.qty = qty;
    row.as_of = today;
  } else {
    ops.inventory_manual.push({ sku, warehouse, qty, as_of: today, notes: '' });
  }
}

function formatDate(value) {
  if (!value) return 'To be confirmed';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function partnerAllocations(ops, code) {
  return ops.b2b_allocations.filter(a => a.partner_code === code);
}

function productsOrdered(ops, code) {
  const items = partnerAllocations(ops, code).filter(a => a.qty > 0);
  if (!items.length) return '—';
  return items.map(a => `${productName(ops, a.sku)} ×${a.qty}`).join(', ');
}

function shipmentBadge(p) {
  const label = SHIPMENT_LABELS[p.shipment_status] || p.shipment_status || 'Unknown';
  const cls = p.shipment_status === 'shipped' && p.shipment_status_confirmed
    ? 'status-ok'
    : p.shipment_status === 'not_shipped'
      ? 'status-wait'
      : 'status-pending';
  return `<span class="status-pill ${cls}">${label}</span>`;
}

async function loadData() {
  let ops;
  try {
    const res = await fetch(`/api/brands/${BRAND_SLUG}`);
    if (res.ok) ops = await res.json();
  } catch (_) {}

  if (!ops) {
    const res = await fetch(`brands/${BRAND_SLUG}/ops-data.json`);
    if (!res.ok) throw new Error('Failed to load data — run: node ops-hub/server.mjs');
    ops = await res.json();
  }

  let shopify = null;
  try {
    const s = await fetch(`brands/${BRAND_SLUG}/shopify-snapshot.json`);
    if (s.ok) shopify = await s.json();
  } catch (_) {}

  return { ops, shopify };
}

async function saveData(ops) {
  ops.meta = ops.meta || {};
  ops.meta.updated_at = new Date().toISOString();
  const res = await fetch(`/api/brands/${BRAND_SLUG}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ops),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Save failed — use node ops-hub/server.mjs');
  }
  return res.json();
}

function calcMetrics(ops) {
  const metrics = {};

  for (const sku of ACTIVE_SKUS) {
    const ledgerBaseline = getLedgerBaseline(ops, sku);
    const b2b = sum(
      ops.b2b_allocations.filter(a => a.sku === sku && allocationCountsTowardStock(ops, a.partner_code)),
      a => a.qty
    );
    const internal = sum(ops.internal_use.filter(a => a.sku === sku), a => a.qty);
    const manual = getManualQty(ops, sku, 'dongguan');
    const calculated = ledgerBaseline - b2b - internal;
    const remaining = manual ?? calculated;
    metrics[sku] = { ledgerBaseline, b2b, internal, remaining, allocated: b2b + internal };
  }

  return {
    metrics,
    warehouseTotal: sum(ACTIVE_SKUS, sku => metrics[sku].remaining),
    b2bTotal: sum(ops.b2b_allocations.filter(a => allocationCountsTowardStock(ops, a.partner_code)), a => a.qty),
    partnerCount: ops.b2b_partners.length,
  };
}

function shopifyQty(shopify, ops, sku) {
  const sync = shopify?.inventory?.find(i => i.sku === sku)?.available;
  if (sync != null) return sync;
  const manual = getManualQty(ops, sku, 'shopify');
  return manual != null ? manual : null;
}

function shipmentCounts(ops) {
  const counts = { shipped: 0, not_shipped: 0, preparing: 0, po_listed: 0 };
  for (const p of ops.b2b_partners) {
    if (counts[p.shipment_status] != null) counts[p.shipment_status] += 1;
  }
  return counts;
}

function renderAll() {
  const { ops, shopify } = state;
  const metrics = calcMetrics(ops);
  renderDashboard(ops, metrics);
  renderCustomers(ops);
  renderStock(ops, shopify, metrics);
  document.getElementById('brand-name').textContent = ops.meta.brand;
  document.getElementById('updated-at').textContent = `Last updated ${ops.meta.updated_at?.slice(0, 10) || '—'}`;
}

function renderDashboard(ops, metrics) {
  const ship = shipmentCounts(ops);
  const awaiting = ship.not_shipped + ship.preparing + ship.po_listed;

  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi kpi-primary">
      <label>Sold to B2B customers</label>
      <strong>${metrics.b2bTotal}</strong>
      <span>Units allocated from China warehouse</span>
    </div>
    <div class="kpi">
      <label>Customers</label>
      <strong>${metrics.partnerCount}</strong>
      <span>${new Set(ops.b2b_partners.map(p => p.country)).size} countries</span>
    </div>
    <div class="kpi ${awaiting > 0 ? 'kpi-warn' : 'kpi-ok'}">
      <label>Customers awaiting shipment</label>
      <strong>${awaiting}</strong>
      <span>${ship.shipped} already shipped</span>
    </div>`;

  document.getElementById('stock-bars').innerHTML = ACTIVE_SKUS.map(sku => {
    const m = metrics.metrics[sku];
    const availPct = m.ledgerBaseline ? Math.round((m.remaining / m.ledgerBaseline) * 100) : 0;
    return `
      <div class="stock-bar-row">
        <div class="stock-bar-head">
          <strong>${productName(ops, sku)}</strong>
          <span class="stock-bar-qty"><em>${m.remaining}</em> available</span>
        </div>
        <div class="stock-bar-track" role="img" aria-label="${m.remaining} of ${m.ledgerBaseline} available">
          <div class="stock-bar-available" style="width:${Math.max(availPct, 2)}%"></div>
        </div>
        <p class="stock-bar-meta">${m.allocated} committed · ${m.ledgerBaseline} total in warehouse</p>
      </div>`;
  }).join('');

  const review = ops.b2b_pending_review;
  const noteEl = document.getElementById('dashboard-note');
  noteEl.innerHTML = review
    ? `<div class="note-box" role="note">
        <strong>Needs your input</strong>
        <p>${review.question}</p>
        <p class="note-detail">${review.pending_totals?.combined || 0} units · Bangladesh, Serbia, Jordan, Cambodia, Nepal</p>
      </div>`
    : '';
}

function renderCustomers(ops) {
  const ship = shipmentCounts(ops);
  const partners = ops.b2b_partners
    .map(p => {
      const total = sum(partnerAllocations(ops, p.code), a => a.qty);
      const needsReview = p.counts_toward_stock === false;
      const note = needsReview
        ? 'Confirm whether this is a separate China order or fulfilled through another distributor.'
        : (p.notes || '');
      return { p, total, note, needsReview };
    })
    .sort((a, b) => b.total - a.total);

  document.getElementById('customers-summary').innerHTML = `
    <p class="summary-line">
      <strong>${ops.b2b_partners.length}</strong> customers ·
      <strong>${ship.shipped}</strong> shipped ·
      <strong>${ship.not_shipped + ship.preparing + ship.po_listed}</strong> in progress
    </p>`;

  const rows = partners.map(({ p, total, note, needsReview }) => `
    <tr class="${needsReview ? 'row-highlight' : ''}">
      <td><strong>${p.name}</strong></td>
      <td>${p.country}</td>
      <td class="products-cell">${productsOrdered(ops, p.code)}</td>
      <td class="num strong">${total}</td>
      <td>${shipmentBadge(p)}</td>
      <td>${formatDate(p.eta_estimated)}</td>
      <td class="notes-cell">${note || '—'}</td>
    </tr>`).join('');

  document.getElementById('customers-table').innerHTML = `
    <div class="table-scroll">
      <table class="data-table exec-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Country</th>
            <th>Products ordered</th>
            <th class="num">Total units</th>
            <th>Shipment</th>
            <th>Est. arrival</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderStock(ops, shopify, metrics) {
  document.getElementById('stock-cards').innerHTML = ACTIVE_SKUS.map(sku => {
    const m = metrics.metrics[sku];
    const shop = shopifyQty(shopify, ops, sku);
    const shopLabel = shop != null ? shop : '—';
    const shopHint = shopify ? 'Synced from online store' : 'Not synced yet';
    return `
      <article class="stock-card">
        <h3>${productName(ops, sku)}</h3>
        <div class="stock-card-locations">
          <div class="stock-location">
            <span class="stock-location-label">China warehouse</span>
            <span class="stock-location-value">${m.remaining}</span>
          </div>
          <div class="stock-location">
            <span class="stock-location-label">Online store</span>
            <span class="stock-location-value">${shopLabel}</span>
            <span class="stock-location-hint">${shopHint}</span>
          </div>
        </div>
      </article>`;
  }).join('');

  const el = document.getElementById('stock-editor');
  el.innerHTML = `
    <p class="editor-hint">Quick count updates only. Tell Koji for order or customer changes.</p>
    <div class="editor-grid">
      ${ACTIVE_SKUS.map(sku => {
        const m = metrics.metrics[sku];
        const shop = getManualQty(ops, sku, 'shopify') ?? 0;
        return `
          <fieldset class="editor-card">
            <legend>${productName(ops, sku)}</legend>
            <label>China warehouse<input type="number" min="0" data-field="dongguan" data-sku="${sku}" value="${m.remaining}"></label>
            <label>Online store<input type="number" min="0" data-field="shopify" data-sku="${sku}" value="${shop}"></label>
          </fieldset>`;
      }).join('')}
    </div>
    <button type="button" class="btn-save" id="btn-save-stock">Save changes</button>
    <p id="save-status" class="save-status" aria-live="polite"></p>`;
}

async function handleStockSave(e) {
  if (e.target.id !== 'btn-save-stock') return;
  const el = document.getElementById('stock-editor');
  const status = document.getElementById('save-status');
  status.textContent = 'Saving…';
  status.className = 'save-status';
  for (const sku of ACTIVE_SKUS) {
    const dg = el.querySelector(`[data-field="dongguan"][data-sku="${sku}"]`);
    const sh = el.querySelector(`[data-field="shopify"][data-sku="${sku}"]`);
    setManualQty(state.ops, sku, 'dongguan', Number(dg.value));
    setManualQty(state.ops, sku, 'shopify', Number(sh.value));
  }
  try {
    await saveData(state.ops);
    state.ops = (await loadData()).ops;
    renderAll();
    status.textContent = 'Saved.';
    status.className = 'save-status ok';
  } catch (err) {
    status.textContent = err.message;
    status.className = 'save-status err';
  }
}

function setupTheme() {
  const btn = document.getElementById('theme-toggle');
  const icon = btn.querySelector('.theme-toggle-icon');
  const label = btn.querySelector('.theme-toggle-label');

  function apply(theme) {
    const dark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    icon.textContent = dark ? '☾' : '☀';
    label.textContent = dark ? 'Dark' : 'Light';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    localStorage.setItem('ops-hub-theme', dark ? 'dark' : 'light');
  }

  apply(localStorage.getItem('ops-hub-theme') || 'light');
  btn.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    apply(dark ? 'light' : 'dark');
  });
}

function setupNav() {
  const titles = {
    dashboard: ['Dashboard', 'Inventory and distributor orders at a glance'],
    customers: ['Customers', 'Who ordered what, and where shipments stand'],
    stock: ['Stock', 'China warehouse and online store'],
  };

  document.querySelectorAll('.nav').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      document.querySelectorAll('.nav').forEach(b => {
        b.classList.remove('active');
        b.removeAttribute('aria-current');
      });
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');
      document.getElementById(`view-${view}`).classList.add('active');
      const [t, s] = titles[view];
      document.getElementById('view-title').textContent = t;
      document.getElementById('view-subtitle').textContent = s;
    });
  });
}

async function main() {
  setupTheme();
  setupNav();
  document.getElementById('stock-update-panel').addEventListener('click', handleStockSave);
  try {
    state = await loadData();
    renderAll();
  } catch (e) {
    document.querySelector('.main').innerHTML = `<div class="empty-state">
      Could not load data.<br><br>
      <code>node ops-hub/server.mjs</code><br><br>${e.message}
    </div>`;
  }
}

main();
