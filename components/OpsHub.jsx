'use client';

import Image from 'next/image';
import Link from 'next/link';
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

const NAV_ITEMS = [
  { id: 'dashboard', href: '/', label: 'Dashboard' },
  { id: 'customers', href: '/customers', label: 'Customers' },
  { id: 'stock', href: '/stock', label: 'Stock' },
];

export default function OpsHub({ initialData, authEnabled, view = 'dashboard' }) {
  const ops = initialData;
  const [theme, setTheme] = useState('dark');

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
    <div className="layout">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <Image className="brand-logo" src="/FLogo.png" alt="Finecoustic" width={44} height={44} />
          <div>
            <strong>{ops.meta.brand}</strong>
            <small>Operations</small>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Sections">
          {NAV_ITEMS.map(({ id, href, label }) => (
            <Link
              key={id}
              href={href}
              className={`nav${view === id ? ' active' : ''}`}
              aria-current={view === id ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
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
                <p className="panel-desc">
                  Dongguan (Axia). Customer orders — shipped or waiting — all count against warehouse stock.
                </p>
                <p className="data-updated-label">Inventory last updated: {inventoryDataUpdated}</p>
              </header>
              <div className="stock-bars">
                {ACTIVE_SKUS.map(sku => {
                  const m = metrics.metrics[sku];
                  const row = reconciliation.items.find(r => r.sku === sku);
                  const free = m.axiaAfterOrders ?? 0;
                  const barDenom = Math.max(
                    m.warehouseQty,
                    row?.inWarehouseAccounted ?? 0,
                    1
                  );
                  const segPct = n =>
                    `${Math.max((n / barDenom) * 100, n > 0 ? 2 : 0)}%`;
                  return (
                    <div key={sku} className="stock-bar-row">
                      <div className="stock-bar-head">
                        <strong>{productName(ops, sku)}</strong>
                        <span className="stock-bar-qty">
                          <em>{m.axiaAfterOrders ?? '—'}</em> free to use
                          <span className="stock-bar-qty-sub">{m.warehouseQty} in warehouse (Axia)</span>
                        </span>
                      </div>
                      <p className="stock-bar-label">
                        In warehouse ({m.warehouseQty} total)
                        {row?.overCommitted && (
                          <span className="stock-bar-over">
                            {' '}
                            — {row.inWarehouseAccounted} logged against this
                          </span>
                        )}
                      </p>
                      <div
                        className={`stock-bar-track stock-bar-stacked${row?.overCommitted ? ' stock-bar-track-warn' : ''}`}
                        role="img"
                        aria-label={`${m.b2bShipped} shipped, ${m.b2bReserved} waiting, ${m.internal} personal, ${free} free`}
                      >
                        {m.b2bShipped > 0 && (
                          <div className="stock-bar-seg stock-bar-seg-shipped" style={{ width: segPct(m.b2bShipped) }} />
                        )}
                        {m.b2bReserved > 0 && (
                          <div className="stock-bar-seg stock-bar-seg-customer" style={{ width: segPct(m.b2bReserved) }} />
                        )}
                        {m.internal > 0 && (
                          <div className="stock-bar-seg stock-bar-seg-personal" style={{ width: segPct(m.internal) }} />
                        )}
                        {m.axiaAfterOrders != null && m.axiaAfterOrders > 0 && (
                          <div className="stock-bar-seg stock-bar-seg-available" style={{ width: segPct(m.axiaAfterOrders) }} />
                        )}
                      </div>
                      <div className="stock-bar-legend">
                        <span><i className="stock-bar-seg-shipped" /> {m.b2bShipped} shipped (in stock)</span>
                        <span><i className="stock-bar-seg-customer" /> {m.b2bReserved} waiting</span>
                        <span><i className="stock-bar-seg-personal" /> {m.internal} personal</span>
                        <span><i className="stock-bar-seg-available" /> {m.axiaAfterOrders ?? '—'} free</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {reconciliation.hasAnyIssue && (
                <div className="stock-reconcile" role="note">
                  <header className="stock-reconcile-head">
                    <strong>Numbers don&apos;t match yet</strong>
                    <p>
                      Axia&apos;s warehouse count and our customer order log should fit together — they
                      don&apos;t right now. Treat &ldquo;free to use&rdquo; as unreliable until this is
                      cleared with Axia.
                    </p>
                  </header>
                  <div className="stock-reconcile-grid">
                    {reconciliation.items.map(row => (
                      <div key={row.sku} className="stock-reconcile-card">
                        <h3>{productName(ops, row.sku)}</h3>
                        <div className="stock-reconcile-compare">
                          <div className="stock-reconcile-col">
                            <h4>What Axia says</h4>
                            <ul>
                              <li>
                                <span>In warehouse</span>
                                <strong>{row.warehouseQty}</strong>
                              </li>
                              <li>
                                <span>Free to use</span>
                                <strong>{row.axiaAfterOrders ?? '—'}</strong>
                              </li>
                            </ul>
                          </div>
                          <div className="stock-reconcile-col">
                            <h4>What we logged</h4>
                            <p className="stock-reconcile-note">
                              Shipped and waiting orders both count against warehouse stock.
                            </p>
                            <ul>
                              <li>
                                <span>Shipped (still in stock)</span>
                                <strong>{row.b2bShipped}</strong>
                              </li>
                              <li>
                                <span>Waiting to ship</span>
                                <strong>{row.b2bReserved}</strong>
                              </li>
                              <li>
                                <span>Personal samples</span>
                                <strong>{row.internal}</strong>
                              </li>
                              <li>
                                <span>Free to use</span>
                                <strong>{row.axiaAfterOrders ?? '—'}</strong>
                              </li>
                            </ul>
                            {row.waitingCustomers.length > 0 && (
                              <p className="stock-reconcile-customers">
                                Still waiting: {row.waitingCustomers.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="stock-reconcile-problem">
                          <h4>What&apos;s wrong</h4>
                          <ul>
                            {row.overCommitted && (
                              <li>
                                Axia says <strong>{row.warehouseQty}</strong> are in the warehouse, but
                                shipped ({row.b2bShipped}) + waiting ({row.b2bReserved}) + samples (
                                {row.internal}) + free ({row.axiaAfterOrders ?? '—'}) adds up to{' '}
                                <strong>{row.inWarehouseAccounted}</strong> —{' '}
                                <strong>{Math.abs(row.inWarehouseGap)} units</strong> more than fit.
                              </li>
                            )}
                            {!row.overCommitted && row.inWarehouseGap > 0 && (
                              <li>
                                Axia says <strong>{row.warehouseQty}</strong> are in the warehouse, but
                                shipped + waiting + samples + free only accounts for{' '}
                                <strong>{row.inWarehouseAccounted}</strong> —{' '}
                                <strong>{row.inWarehouseGap} units</strong> missing from our log.
                              </li>
                            )}
                            {row.axiaDelta != null && row.axiaDelta !== 0 && (
                              <li>
                                Axia says <strong>{row.axiaAfterOrders}</strong> are free to use. After
                                all customer orders ({row.b2bAll}) and samples ({row.internal}), we&apos;d
                                expect <strong>{row.calcAvailable}</strong> — a difference of{' '}
                                <strong>{Math.abs(row.axiaDelta)}</strong>.
                              </li>
                            )}
                          </ul>
                          <p className="stock-reconcile-cause">
                            Customer orders take warehouse stock whether they&apos;ve shipped or not.
                            The gap means our order quantities, warehouse count, or Axia&apos;s free count
                            don&apos;t agree — confirm all three with Axia.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="stock-reconcile-foot">
                    Next step: confirm warehouse count, free count, and which orders are still in
                    Dongguan with Axia before the next shipment or transfer.
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
