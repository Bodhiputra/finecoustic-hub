'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import B2bRetailerPoolFormPanel from '@/components/ops/B2bRetailerPoolFormPanel';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  B2B_RETAILER_SECTIONS,
  B2B_TAG_LABEL_KEYS,
  collectB2bCountryOptions,
  countB2bBySection,
  filterB2bBySection,
  kolLinkAriaLabel,
  kolLinkIconName,
  normalizeB2bRetailerTag,
} from '@/lib/b2b-retailer-pool';
import {
  partnerAllocations,
  productsOrdered,
  SHIPMENT_LABELS,
  shipmentStatusClass,
  formatDate,
} from '@/lib/ops';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

function KolChip({ children, className = '' }) {
  if (!children) return null;
  return <span className={`kol-chip ${className}`.trim()}>{children}</span>;
}

function partnerOrderSummary(ops, partnerCode) {
  if (!ops || !partnerCode) return null;
  const p = ops.b2b_partners?.find(x => x.code === partnerCode);
  if (!p) return null;
  const total = partnerAllocations(ops, partnerCode).reduce((a, x) => a + x.qty, 0);
  return {
    partner: p,
    total,
    products: productsOrdered(ops, partnerCode),
  };
}

export default function B2bRetailerPoolWorkspace({
  initialRecords = [],
  initialCounts = null,
  initialSection = 'all',
  opsData = null,
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [section, setSection] = useState(initialSection);
  const [records, setRecords] = useState(initialRecords);
  const [counts, setCounts] = useState(initialCounts || countB2bBySection(initialRecords));
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sectionRecords = useMemo(
    () => filterB2bBySection(records, section),
    [records, section]
  );

  const countryOptions = useMemo(() => collectB2bCountryOptions(sectionRecords), [sectionRecords]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sectionRecords.filter(r => {
      if (countryFilter !== 'all' && String(r.country || '').trim() !== countryFilter) return false;
      if (!q) return true;
      const hay = [r.name, r.country, r.website, r.partner_code, r.links, r.tag].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [sectionRecords, countryFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const rangeFrom = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeTo = filtered.length ? Math.min(safePage * pageSize, filtered.length) : 0;

  useEffect(() => {
    setPage(1);
  }, [section, query, countryFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function refreshFromServer(nextSection = section) {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_V1.opsB2bRetailers}?section=all`, { credentials: 'same-origin' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const data = unwrapData(body);
      setRecords(Array.isArray(data?.records) ? data.records : []);
      if (data?.counts) setCounts(data.counts);
    } finally {
      setRefreshing(false);
    }
  }

  function handleSaved(record) {
    if (!record) return;
    setRecords(prev => {
      const idx = prev.findIndex(r => r.id === record.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      }
      return [...prev, record].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    });
    setCounts(countB2bBySection(
      (() => {
        const idx = records.findIndex(r => r.id === record.id);
        if (idx >= 0) {
          const next = [...records];
          next[idx] = record;
          return next;
        }
        return [...records, record];
      })()
    ));
    refreshFromServer();
  }

  function handleDeleted(id) {
    setRecords(prev => prev.filter(r => r.id !== id));
    setCounts(countB2bBySection(records.filter(r => r.id !== id)));
    refreshFromServer();
  }

  return (
    <div className="kol-pool-workspace b2b-retailer-pool">
      <header className="kol-pool-head">
        <div>
          <h1 className="kol-pool-title">{t('hub.b2bRetailers.title')}</h1>
          <p className="kol-pool-subtitle">{t('hub.b2bRetailers.subtitle')}</p>
        </div>
        <button type="button" className="hub-btn hub-btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} />
          {t('hub.b2bRetailers.addRetailer')}
        </button>
      </header>

      <nav className="kol-pool-sections" aria-label={t('hub.b2bRetailers.sectionsLabel')}>
        {B2B_RETAILER_SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            className={`kol-pool-section-btn${section === s.id ? ' is-active' : ''}`}
            aria-current={section === s.id ? 'true' : undefined}
            onClick={() => setSection(s.id)}
          >
            {t(s.labelKey)}
            <span className="kol-pool-section-count">{counts[s.id] ?? 0}</span>
          </button>
        ))}
      </nav>

      <div className="kol-pool-toolbar">
        <label className="kol-pool-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('hub.b2bRetailers.searchPlaceholder')}
          />
        </label>
        <label className="kol-pool-filter">
          <span>{t('hub.b2bRetailers.filterCountry')}</span>
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            aria-label={t('hub.b2bRetailers.filterCountry')}
          >
            <option value="all">{t('hub.campaignKol.filterAll')}</option>
            {countryOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="hub-btn hub-btn-ghost kol-pool-refresh"
          onClick={() => refreshFromServer()}
          disabled={refreshing}
        >
          {refreshing ? t('common.loading') : t('hub.b2bRetailers.refresh')}
        </button>
        <span className="kol-pool-result-count">
          {filtered.length
            ? t('hub.b2bRetailers.showingRange')
                .replace('{from}', String(rangeFrom))
                .replace('{to}', String(rangeTo))
                .replace('{total}', String(filtered.length))
            : t('hub.b2bRetailers.showing').replace('{count}', '0')}
        </span>
        <label className="kol-pool-page-size">
          <span>{t('hub.b2bRetailers.perPage')}</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value) || DEFAULT_PAGE_SIZE)}
            aria-label={t('hub.b2bRetailers.perPage')}
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="internal-empty personal-hub-hint">
          {records.length === 0 ? t('hub.b2bRetailers.emptyPool') : t('hub.b2bRetailers.emptySection')}
        </p>
      ) : (
        <div className="kol-pool-table-wrap h-scroll">
          <table className="kol-pool-table">
            <thead>
              <tr>
                <th>{t('hub.b2bRetailers.colName')}</th>
                <th>{t('hub.b2bRetailers.colTag')}</th>
                <th>{t('hub.b2bRetailers.colCountry')}</th>
                <th>{t('hub.b2bRetailers.colPartnerCode')}</th>
                <th>{t('hub.b2bRetailers.colOrders')}</th>
                <th>{t('hub.b2bRetailers.colWebsite')}</th>
                <th>{t('hub.b2bRetailers.colLinks')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(row => {
                const order = partnerOrderSummary(opsData, row.partner_code);
                const tagId = normalizeB2bRetailerTag(row.tag);
                const tagLabel = tagId && B2B_TAG_LABEL_KEYS[tagId] ? t(B2B_TAG_LABEL_KEYS[tagId]) : row.tag;
                return (
                  <tr
                    key={row.id}
                    className="kol-pool-row-click"
                    title={t('hub.b2bRetailers.editRowHint')}
                    onClick={() => setEditing(row)}
                  >
                    <td className="kol-pool-channel">
                      <strong>{row.name}</strong>
                    </td>
                    <td>
                      <KolChip className="kol-chip-tag">{tagLabel || '—'}</KolChip>
                    </td>
                    <td>
                      <KolChip className="kol-chip-country">{row.country || '—'}</KolChip>
                    </td>
                    <td>{row.partner_code || '—'}</td>
                    <td className="kol-pool-collab">
                      {order ? (
                        <>
                          <span className="status-pill">{order.total} units</span>
                          <span className="b2b-retailer-order-meta">
                            {order.products} ·{' '}
                            <span className={`status-pill ${shipmentStatusClass(order.partner)}`}>
                              {SHIPMENT_LABELS[order.partner.shipment_status] || order.partner.shipment_status}
                            </span>
                            {order.partner.eta_estimated ? (
                              <> · {formatDate(order.partner.eta_estimated)}</>
                            ) : null}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {row.website ? (
                        <a
                          href={row.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                        >
                          {row.website.replace(/^https?:\/\//, '').slice(0, 40)}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="kol-pool-links">
                      {row.links ? (
                        <a
                          href={row.links}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`kol-pool-link-icon is-${kolLinkIconName(row)}`}
                          aria-label={kolLinkAriaLabel(row, t)}
                          title={kolLinkAriaLabel(row, t)}
                          onClick={e => e.stopPropagation()}
                        >
                          <Icon name={kolLinkIconName(row)} size={16} />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > pageSize ? (
        <nav className="kol-pool-pagination" aria-label={t('hub.b2bRetailers.paginationLabel')}>
          <button
            type="button"
            className="kol-pool-page-btn"
            onClick={() => setPage(current => Math.max(1, current - 1))}
            disabled={safePage <= 1}
          >
            <Icon name="chevronLeft" size={16} />
            {t('hub.b2bRetailers.prevPage')}
          </button>
          <span className="kol-pool-page-status">
            {t('hub.b2bRetailers.pageOf')
              .replace('{page}', String(safePage))
              .replace('{pages}', String(totalPages))}
          </span>
          <button
            type="button"
            className="kol-pool-page-btn"
            onClick={() => setPage(current => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
          >
            {t('hub.b2bRetailers.nextPage')}
            <Icon name="chevronRight" size={16} />
          </button>
        </nav>
      ) : null}

      {editing ? (
        <B2bRetailerPoolFormPanel
          mode="edit"
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}

      {creating ? (
        <B2bRetailerPoolFormPanel
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
