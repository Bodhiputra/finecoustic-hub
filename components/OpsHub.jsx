'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import Icon from '@/components/Icon';
import OpsStockPanel from '@/components/ops/OpsStockPanel';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import {
  ACTIVE_SKUS,
  calcMetrics,
  calcStockReconciliation,
  inventoryDataUpdatedAt,
  formatDataDate,
  productName,
  shipmentCounts,
} from '@/lib/ops';

const VIEW_META = {
  dashboard: ['Dashboard', 'Inventory and distributor orders at a glance'],
  stock: ['Stock', 'China warehouse and online store'],
};

export const OPS_VIEW_META = VIEW_META;

const NAV_ITEMS = [
  { id: 'dashboard', href: '/ops?tool=dashboard', label: 'Dashboard' },
  { id: 'stock', href: '/ops?tool=stock', label: 'Stock' },
];

export function OpsHubContent({
  initialData,
  view = 'dashboard',
  shopifyConfigured = false,
  shopifySnapshot = null,
}) {
  const ops = initialData;

  const metrics = useMemo(() => calcMetrics(ops), [ops]);
  const reconciliation = useMemo(() => calcStockReconciliation(ops), [ops]);
  const ship = useMemo(() => shipmentCounts(ops), [ops]);
  const awaiting = ship.not_shipped + ship.preparing + ship.po_listed;

  const inventoryDataUpdated = formatDataDate(inventoryDataUpdatedAt(ops));

  return (
    <>
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

        {view === 'stock' && (
          <OpsStockPanel
            initialOps={ops}
            shopifyConfigured={shopifyConfigured}
            shopifySnapshot={shopifySnapshot}
          />
        )}
    </>
  );
}

export default function OpsHub({
  initialData,
  authEnabled,
  view = 'dashboard',
  embedded = false,
  shopifyConfigured = false,
  shopifySnapshot = null,
}) {
  const ops = initialData;
  const { t } = useLocale();
  const [title, subtitle] = VIEW_META[view] || VIEW_META.dashboard;
  const content = (
    <OpsHubContent
      initialData={initialData}
      view={view}
      shopifyConfigured={shopifyConfigured}
      shopifySnapshot={shopifySnapshot}
    />
  );

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (embedded) return content;

  return (
    <HubLayout
      sidebarLabel="Operations"
      topNavTitle={title}
      authEnabled={authEnabled}
      onLogout={handleLogout}
      sidebar={
        <>
          <div className="brand">
            <Link href="/" className="brand-back" aria-label="Teams home">
              <Icon name="arrowLeft" size={16} />
            </Link>
            <Image className="brand-logo" src="/FLogo.png" alt="Finecoustic" width={36} height={36} />
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
        </>
      }
    >
      <main className="main">
        {content}
      </main>
    </HubLayout>
  );
}
