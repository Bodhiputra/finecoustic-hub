'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  ACTIVE_SKUS,
  SHIPMENT_LABELS,
  calcMetrics,
  calcStockReconciliation,
  customerDataUpdatedAt,
  inventoryDataUpdatedAt,
  shopifyDataUpdatedAt,
  formatDataDate,
  formatDate,
  partnerAllocations,
  productName,
  productsOrdered,
  shipmentCounts,
  shipmentStatusClass,
  shopifyQty,
} from '@/lib/ops';

const VIEW_META = {
  dashboard: ['Dashboard', 'Inventory and distributor orders at a glance'],
  customers: ['Customers', 'Who ordered what, and where shipments stand'],
  stock: ['Stock', 'China warehouse and online store'],
};

export default function OpsHub({ initialData, authEnabled }) {
  const ops = initialData;
  const [view, setView] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [menuOpen, setMenuOpen] = useState(false);

  const metrics = useMemo(() => calcMetrics(ops), [ops]);
  const reconciliation = useMemo(() => calcStockReconciliation(ops), [ops]);
  const ship = useMemo(() => shipmentCounts(ops), [ops]);
  const awaiting = ship.not_shipped + ship.preparing + ship.po_listed;

  useEffect(() => {
    const stored = localStorage.getItem('ops-hub-theme');
    const next = stored === 'light' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectView = id => {
    setView(id);
    setMenuOpen(false);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ops-hub-theme', next);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const partners = ops.b2b_partners
    .map(p => {
      const total = partnerAllocations(ops, p.code).reduce((a, x) => a + x.qty, 0);
      const needsReview = p.counts_toward_stock === false;
      const note = needsReview
        ? 'Confirm whether this is a separate China order or fulfilled through another distributor.'
        : (p.notes || '');
      return { p, total, note, needsReview };
    })
    .sort((a, b) => b.total - a.total);

  const [title, subtitle] = VIEW_META[view];
  const customerDataUpdated = formatDataDate(customerDataUpdatedAt(ops));
  const inventoryDataUpdated = formatDataDate(inventoryDataUpdatedAt(ops));
  const shopifyDataUpdated = formatDataDate(shopifyDataUpdatedAt(ops));

  return (
    <div className={`layout${menuOpen ? ' menu-open' : ''}`}>
      <button
        type="button"
        className="sidebar-overlay"
        aria-label="Close menu"
        onClick={() => setMenuOpen(false)}
        tabIndex={menuOpen ? 0 : -1}
      />
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <Image className="brand-logo" src="/FLogo.png" alt="Finecoustic" width={44} height={44} />
          <div>
            <strong>{ops.meta.brand}</strong>
            <small>Operations</small>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Sections">
          {['dashboard', 'customers', 'stock'].map(id => (
            <button
              key={id}
              type="button"
              className={`nav${view === id ? ' active' : ''}`}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => selectView(id)}
            >
              {id === 'dashboard' ? 'Dashboard' : id === 'customers' ? 'Customers' : 'Stock'}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(open => !open)}
          >
            <span className="menu-toggle-bar" />
            <span className="menu-toggle-bar" />
            <span className="menu-toggle-bar" />
          </button>
          <div className="topbar-text">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
            {authEnabled && (
              <button type="button" className="btn-ghost" onClick={handleLogout}>
                Sign out
              </button>
            )}
          </div>
        </header>

        {view === 'dashboard' && (
          <section className="view active">
            <div className="kpi-grid">
              <div className="kpi kpi-primary">
                <label>Shipped to B2B (confirmed)</label>
                <strong>{metrics.b2bShippedTotal}</strong>
                <span>Warehouse outbound report — ground truth</span>
              </div>
              <div className="kpi">
                <label>Customers</label>
                <strong>{metrics.partnerCount}</strong>
                <span>{new Set(ops.b2b_partners.map(p => p.country)).size} countries</span>
              </div>
              <div className={`kpi ${awaiting > 0 ? 'kpi-warn' : 'kpi-ok'}`}>
                <label>Customers awaiting shipment</label>
                <strong>{awaiting}</strong>
                <span>{ship.shipped} already shipped</span>
              </div>
            </div>

            <article className="panel panel-full">
              <header className="panel-head">
                <h2>Warehouse stock</h2>
                <p className="panel-desc">Dongguan (Axia). Only outbound shipments are confirmed; orders pending until shipped.</p>
                <p className="data-updated-label">Inventory last updated: {inventoryDataUpdated}</p>
              </header>
              <div className="stock-bars">
                {ACTIVE_SKUS.map(sku => {
                  const m = metrics.metrics[sku];
                  const totalScale = m.warehouseQty + m.b2bShipped || 1;
                  const shippedPct = n => `${Math.max((n / totalScale) * 100, n > 0 ? 2 : 0)}%`;
                  const warehousePct = n => `${Math.max((n / (m.warehouseQty || 1)) * 100, n > 0 ? 2 : 0)}%`;
                  const inWarehouseOther = Math.max(
                    m.warehouseQty - m.b2bReserved - m.internal - (m.axiaAfterOrders ?? 0),
                    0
                  );
                  return (
                    <div key={sku} className="stock-bar-row">
                      <div className="stock-bar-head">
                        <strong>{productName(ops, sku)}</strong>
                        <span className="stock-bar-qty">
                          <em>{m.axiaAfterOrders ?? '—'}</em> available
                          <span className="stock-bar-qty-sub">{m.warehouseQty} in warehouse (Axia)</span>
                        </span>
                      </div>
                      <p className="stock-bar-label">Shipped (confirmed)</p>
                      <div
                        className="stock-bar-track stock-bar-stacked"
                        role="img"
                        aria-label={`${m.b2bShipped} units shipped`}
                      >
                        <div className="stock-bar-seg stock-bar-seg-shipped" style={{ width: shippedPct(m.b2bShipped) }} />
                      </div>
                      <p className="stock-bar-label">In warehouse</p>
                      <div
                        className="stock-bar-track stock-bar-stacked"
                        role="img"
                        aria-label={`${m.b2bReserved} customer pending, ${m.internal} personal, ${m.axiaAfterOrders ?? 0} available`}
                      >
                        {m.b2bReserved > 0 && (
                          <div className="stock-bar-seg stock-bar-seg-customer" style={{ width: warehousePct(m.b2bReserved) }} />
                        )}
                        {m.internal > 0 && (
                          <div className="stock-bar-seg stock-bar-seg-personal" style={{ width: warehousePct(m.internal) }} />
                        )}
                        {m.axiaAfterOrders != null && m.axiaAfterOrders > 0 && (
                          <div className="stock-bar-seg stock-bar-seg-available" style={{ width: warehousePct(m.axiaAfterOrders) }} />
                        )}
                        {inWarehouseOther > 0 && (
                          <div className="stock-bar-seg stock-bar-seg-other" style={{ width: warehousePct(inWarehouseOther) }} />
                        )}
                      </div>
                      <div className="stock-bar-legend">
                        <span><i className="stock-bar-seg-shipped" /> {m.b2bShipped} shipped</span>
                        <span><i className="stock-bar-seg-customer" /> {m.b2bReserved} customer</span>
                        <span><i className="stock-bar-seg-personal" /> {m.internal} personal</span>
                        <span><i className="stock-bar-seg-available" /> {m.axiaAfterOrders ?? '—'} available</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {reconciliation.hasAnyIssue && (
                <div className="stock-reconcile" role="note">
                  <header className="stock-reconcile-head">
                    <strong>Stock count doesn&apos;t reconcile</strong>
                    <p>
                      Axia reports warehouse on-hand, available-after-orders, and our customer
                      allocations separately — the numbers below don&apos;t add up yet.
                    </p>
                  </header>
                  <div className="stock-reconcile-grid">
                    {reconciliation.items.map(row => (
                      <div key={row.sku} className="stock-reconcile-card">
                        <h3>{productName(ops, row.sku)}</h3>
                        <dl className="stock-reconcile-dl">
                          {row.inWarehouseGap !== 0 && (
                            <>
                              <dt>In-warehouse bar gap</dt>
                              <dd className="stock-reconcile-warn">
                                {row.inWarehouseGap > 0 ? '+' : ''}
                                {row.inWarehouseGap} units unaccounted
                                <span>
                                  {row.warehouseQty} in warehouse − {row.b2bReserved} customer
                                  pending − {row.internal} personal − {row.axiaAfterOrders ?? '—'}{' '}
                                  available ≠ 0
                                </span>
                              </dd>
                            </>
                          )}
                          {row.axiaDelta != null && row.axiaDelta !== 0 && (
                            <>
                              <dt>Axia available vs calculated</dt>
                              <dd className="stock-reconcile-warn">
                                Axia {row.axiaAfterOrders}; expected {row.calcAvailable} (
                                {row.axiaDelta > 0 ? '+' : ''}
                                {row.axiaDelta})
                                <span>
                                  Warehouse {row.warehouseQty} minus unshipped customer orders and
                                  samples
                                </span>
                              </dd>
                            </>
                          )}
                          {row.ledgerRemaining < 0 && (
                            <>
                              <dt>Allocations vs warehouse book</dt>
                              <dd className="stock-reconcile-warn">
                                Over-allocated by {Math.abs(row.ledgerRemaining)} units
                                <span>
                                  All customer orders ({row.b2bAll}) plus samples ({row.internal})
                                  exceed warehouse on-hand ({row.warehouseQty}) — shipped units (
                                  {row.b2bShipped}) may be double-counted
                                </span>
                              </dd>
                            </>
                          )}
                        </dl>
                      </div>
                    ))}
                  </div>
                  <p className="stock-reconcile-foot">
                    Ground truth for outbound: confirmed shipments only. Reconcile with Axia before
                    the next transfer or allocation decision.
                  </p>
                </div>
              )}
            </article>

            {ops.b2b_pending_review && (
              <div className="note-box" role="note">
                <strong>Needs your input</strong>
                <p>{ops.b2b_pending_review.question}</p>
                <p className="note-detail">
                  {ops.b2b_pending_review.pending_totals?.combined || 0} units · Bangladesh, Serbia, Jordan, Cambodia, Nepal
                </p>
              </div>
            )}
          </section>
        )}

        {view === 'customers' && (
          <section className="view active">
            <p className="data-updated-label">Customers last updated: {customerDataUpdated}</p>
            <p className="summary-line">
              <strong>{ops.b2b_partners.length}</strong> customers ·{' '}
              <strong>{ship.shipped}</strong> shipped ·{' '}
              <strong>{awaiting}</strong> in progress
            </p>
            <article className="panel panel-full">
              <div className="table-scroll">
                <table className="data-table exec-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Country</th>
                      <th>Products ordered</th>
                      <th className="num">Total units</th>
                      <th>Shipment</th>
                      <th>Est. arrival</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map(({ p, total, note, needsReview }) => (
                      <tr key={p.code} className={needsReview ? 'row-highlight' : undefined}>
                        <td>
                          <span className="customer-code">{p.code}</span>
                          <strong className="customer-name">{p.name}</strong>
                        </td>
                        <td>{p.country}</td>
                        <td className="products-cell">{productsOrdered(ops, p.code)}</td>
                        <td className="num strong">{total}</td>
                        <td>
                          <span className={`status-pill ${shipmentStatusClass(p)}`}>
                            {SHIPMENT_LABELS[p.shipment_status] || p.shipment_status}
                          </span>
                        </td>
                        <td>{formatDate(p.eta_estimated)}</td>
                        <td className="notes-cell">{note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {view === 'stock' && (
          <section className="view active">
            <p className="data-updated-label">
              Inventory last updated: {inventoryDataUpdated} · Shopify last updated: {shopifyDataUpdated}
            </p>
            <div className="stock-cards">
              {ACTIVE_SKUS.map(sku => {
                const m = metrics.metrics[sku];
                const shop = shopifyQty(null, ops, sku);
                return (
                  <article key={sku} className="stock-card">
                    <h3>{productName(ops, sku)}</h3>
                    <div className="stock-card-locations">
                      <div>
                        <span className="stock-location-label">Available (Axia)</span>
                        <span className="stock-location-value">{m.axiaAfterOrders ?? '—'}</span>
                        <span className="stock-location-hint">{m.warehouseQty} in warehouse · {m.b2bShipped} shipped</span>
                      </div>
                      <div>
                        <span className="stock-location-label">Online store</span>
                        <span className="stock-location-value">{shop != null ? shop : '—'}</span>
                        <span className="stock-location-hint">Not synced yet</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
