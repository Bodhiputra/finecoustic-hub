'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import KolPoolFormPanel from '@/components/marketing/KolPoolFormPanel';
import KolPoolShippingModal from '@/components/marketing/KolPoolShippingModal';
import { useLocale } from '@/components/LocaleProvider';
import {
  KOL_POOL_SECTIONS,
  collectKolMainPlatformOptions,
  filterKolBySection,
  hasKolShippingAddress,
  isHubNativeKol,
  kolLinkAriaLabel,
  kolLinkIconName,
  kolMatchesPlatformFilter,
  kolShippingSummary,
  platformChipClass,
} from '@/lib/kol-pool';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

function formatSyncTime(iso, locale = 'en') {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function KolChip({ children, className = '' }) {
  if (!children) return null;
  return <span className={`kol-chip ${className}`.trim()}>{children}</span>;
}

export default function KolPoolWorkspace({
  initialRecords = [],
  initialMeta = null,
  initialCounts = null,
  initialConfigured = false,
  initialSection = 'masterlist',
}) {
  const { t, locale } = useLocale();
  const [section, setSection] = useState(initialSection);
  const [records, setRecords] = useState(initialRecords);
  const [meta, setMeta] = useState(
    initialMeta || { last_synced_at: null, last_synced_by: '', record_count: 0, last_error: '' }
  );
  const [counts, setCounts] = useState(initialCounts || {});
  const [configured] = useState(initialConfigured);
  const [query, setQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [shippingRow, setShippingRow] = useState(null);

  const sectionRecords = useMemo(
    () => filterKolBySection(records, section),
    [records, section]
  );

  const platformOptions = useMemo(
    () => collectKolMainPlatformOptions(sectionRecords),
    [sectionRecords]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sectionRecords.filter(r => {
      if (!kolMatchesPlatformFilter(r, platformFilter)) return false;
      if (!q) return true;
      const hay = [
        r.channel_name,
        r.country,
        r.main_platform,
        r.kol_category,
        r.tags,
        r.description,
        (r.collaboration_products || []).join(' '),
        kolShippingSummary(r),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sectionRecords, platformFilter, query]);

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
  }, [section, query, platformFilter, pageSize]);

  useEffect(() => {
    if (platformFilter === 'all') return;
    if (!platformOptions.some(option => option.key === platformFilter)) {
      setPlatformFilter('all');
    }
  }, [platformFilter, platformOptions]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function handleSaved(record) {
    if (!record) return;
    setRecords(prev => {
      const idx = prev.findIndex(r => r.notion_page_id === record.notion_page_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [...prev, record].sort((a, b) => a.channel_name.localeCompare(b.channel_name));
    });
  }

  return (
    <div className="kol-pool-workspace">
      <header className="kol-pool-header wrap-row">
        <div className="kol-pool-header-copy">
          <h2 className="kol-pool-title">{t('hub.kol.title')}</h2>
          <p className="kol-pool-subtitle">{t('hub.kol.subtitle')}</p>
          <p className="kol-pool-meta">
            {t('hub.kol.lastSynced')}: {formatSyncTime(meta.last_synced_at, locale)}
            {meta.last_synced_by ? ` · ${meta.last_synced_by}` : ''}
            {meta.last_error ? (
              <span className="kol-pool-meta-error"> · {meta.last_error}</span>
            ) : null}
          </p>
        </div>
        <div className="kol-pool-header-actions wrap-row">
          <button
            type="button"
            className="hub-btn hub-btn--ghost"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={16} />
            <span>{t('hub.kol.addKol')}</span>
          </button>
        </div>
      </header>

      {!configured && (
        <p className="kol-pool-notice personal-hub-hint">{t('hub.kol.notConfigured')}</p>
      )}

      <nav className="kol-pool-tabs wrap-row" aria-label={t('hub.kol.sectionsLabel')}>
        {KOL_POOL_SECTIONS.map(tab => {
          const count = counts[tab.id] ?? filterKolBySection(records, tab.id).length;
          return (
            <button
              key={tab.id}
              type="button"
              className={`kol-pool-tab${section === tab.id ? ' active' : ''}`}
              onClick={() => setSection(tab.id)}
              aria-current={section === tab.id ? 'page' : undefined}
            >
              {t(tab.labelKey)}
              <span className="kol-pool-tab-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <div className="kol-pool-toolbar wrap-row">
        <label className="kol-pool-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('hub.kol.searchPlaceholder')}
            aria-label={t('hub.kol.searchPlaceholder')}
          />
        </label>
        {platformOptions.length ? (
          <label className="kol-pool-filter">
            <span>{t('hub.kol.colPlatform')}</span>
            <select
              value={platformFilter}
              onChange={e => setPlatformFilter(e.target.value)}
              aria-label={t('hub.kol.filterPlatform')}
            >
              <option value="all">{t('hub.campaignKol.filterAll')}</option>
              {platformOptions.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <span className="kol-pool-result-count">
          {filtered.length
            ? t('hub.kol.showingRange')
                .replace('{from}', String(rangeFrom))
                .replace('{to}', String(rangeTo))
                .replace('{total}', String(filtered.length))
            : t('hub.kol.showing').replace('{count}', '0')}
        </span>
        <label className="kol-pool-page-size">
          <span>{t('hub.kol.perPage')}</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value) || DEFAULT_PAGE_SIZE)}
            aria-label={t('hub.kol.perPage')}
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="internal-empty personal-hub-hint">
          {records.length === 0 ? t('hub.kol.emptyPool') : t('hub.kol.emptySection')}
        </p>
      ) : (
        <div className="kol-pool-table-wrap h-scroll">
          <table className="kol-pool-table">
            <thead>
              <tr>
                <th>{t('hub.kol.colChannel')}</th>
                <th>{t('hub.kol.colPlatform')}</th>
                <th>{t('hub.kol.colCountry')}</th>
                <th>{t('hub.kol.colTier')}</th>
                <th>{t('hub.kol.colTags')}</th>
                <th>{t('hub.kol.colCollabProducts')}</th>
                <th>{t('hub.kol.shippingAddress')}</th>
                <th>{t('hub.kol.colLinks')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(row => (
                <tr
                  key={row.notion_page_id}
                  className="kol-pool-row-click"
                  onClick={() => setEditing(row)}
                >
                  <td className="kol-pool-channel">
                    {row.notion_url ? (
                      <a
                        href={row.notion_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                      >
                        {row.channel_name}
                      </a>
                    ) : (
                      row.channel_name
                    )}
                    {isHubNativeKol(row) ? (
                      <span className="kol-chip kol-chip-tag kol-pool-source-chip">{t('hub.kol.sourceHub')}</span>
                    ) : null}
                  </td>
                  <td>
                    <KolChip className={platformChipClass(row.main_platform)}>
                      {row.main_platform || '—'}
                    </KolChip>
                  </td>
                  <td>
                    <KolChip className="kol-chip-country">{row.country || '—'}</KolChip>
                  </td>
                  <td>{row.kol_category || '—'}</td>
                  <td>
                    {row.tags ? <KolChip className="kol-chip-tag">{row.tags}</KolChip> : '—'}
                  </td>
                  <td className="kol-pool-collab">
                    {(row.collaboration_products || []).length
                      ? row.collaboration_products.join(', ')
                      : '—'}
                  </td>
                  <td className="kol-pool-shipping">
                    {hasKolShippingAddress(row) ? (
                      <button
                        type="button"
                        className="kol-pool-shipping-btn"
                        aria-label={t('hub.kol.viewShipping')}
                        title={t('hub.kol.viewShipping')}
                        onClick={e => {
                          e.stopPropagation();
                          setShippingRow(row);
                        }}
                      >
                        <Icon name="box" size={16} />
                      </button>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > pageSize ? (
        <nav className="kol-pool-pagination" aria-label={t('hub.kol.paginationLabel')}>
          <button
            type="button"
            className="kol-pool-page-btn"
            onClick={() => setPage(current => Math.max(1, current - 1))}
            disabled={safePage <= 1}
          >
            <Icon name="chevronLeft" size={16} />
            {t('hub.kol.prevPage')}
          </button>
          <span className="kol-pool-page-status">
            {t('hub.kol.pageOf')
              .replace('{page}', String(safePage))
              .replace('{pages}', String(totalPages))}
          </span>
          <button
            type="button"
            className="kol-pool-page-btn"
            onClick={() => setPage(current => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
          >
            {t('hub.kol.nextPage')}
            <Icon name="chevronRight" size={16} />
          </button>
        </nav>
      ) : null}

      {editing ? (
        <KolPoolFormPanel
          mode="edit"
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {creating ? (
        <KolPoolFormPanel
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={handleSaved}
        />
      ) : null}

      <KolPoolShippingModal
        open={Boolean(shippingRow)}
        record={shippingRow}
        onClose={() => setShippingRow(null)}
      />
    </div>
  );
}
