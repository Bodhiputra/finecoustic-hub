'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  ACTIVE_SKUS,
  SHIPMENT_LABELS,
  calcMetrics,
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

  const metrics = useMemo(() => calcMetrics(ops), [ops]);
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
          {['dashboard', 'customers', 'stock'].map(id => (
            <button
              key={id}
              type="button"
              className={`nav${view === id ? ' active' : ''}`}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
            >
              {id === 'dashboard' ? 'Dashboard' : id === 'customers' ? 'Customers' : 'Stock'}
            </button>
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
