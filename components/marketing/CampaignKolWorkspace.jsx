'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  KOL_DEAL_TYPES,
  KOL_PIPELINE_STATUSES,
  KOL_PUBLISH_STATUSES,
  campaignKolBoardColumns,
  groupCampaignKolByStatus,
} from '@/lib/campaign-kol';
import { campaignKolUrl, campaignListUrl } from '@/lib/campaign-urls';
import { platformChipClass } from '@/lib/kol-pool';
import KolPoolFormPanel from '@/components/marketing/KolPoolFormPanel';

function formatDate(value, locale) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US');
  } catch {
    return value;
  }
}

function KolPickerModal({ open, poolRecords, existingIds, onClose, onAdd, busy }) {
  const { t } = useLocale();
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setQuery('');
    }
  }, [open]);

  if (!open) return null;

  const available = poolRecords.filter(r => !existingIds.has(r.notion_page_id));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? available.filter(r => [r.channel_name, r.main_platform, r.country].join(' ').toLowerCase().includes(q))
    : available;

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="kol-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="kol-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header className="kol-modal-head">
          <h3>{t('hub.campaignKol.addFromPool')}</h3>
          <button type="button" className="appdev-btn-ghost" onClick={onClose} aria-label={t('common.cancel')}>
            <Icon name="x" size={16} />
          </button>
        </header>
        <input
          type="search"
          className="kol-modal-search"
          placeholder={t('hub.kol.searchPlaceholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <ul className="kol-modal-list">
          {filtered.length === 0 ? (
            <li className="kol-modal-empty">{t('hub.campaignKol.noPoolMatches')}</li>
          ) : (
            filtered.map(r => (
              <li key={r.notion_page_id}>
                <label className="kol-modal-row">
                  <input
                    type="checkbox"
                    checked={selected.has(r.notion_page_id)}
                    onChange={() => toggle(r.notion_page_id)}
                  />
                  <span className="kol-modal-row-name">{r.channel_name}</span>
                  <span className={`kol-chip ${platformChipClass(r.main_platform)}`}>{r.main_platform || '—'}</span>
                  <span className="kol-chip kol-chip-country">{r.country || '—'}</span>
                </label>
              </li>
            ))
          )}
        </ul>
        <footer className="kol-modal-foot">
          <button type="button" className="appdev-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="appdev-btn-primary"
            disabled={busy || selected.size === 0}
            onClick={() => onAdd([...selected])}
          >
            {t('hub.campaignKol.addSelected').replace('{count}', String(selected.size))}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CampaignKolCard({ entry, onEdit, t }) {
  const kol = entry.kol;
  return (
    <button type="button" className="campaign-kol-card" onClick={() => onEdit(entry)}>
      <strong>{kol?.channel_name || entry.kol_notion_page_id}</strong>
      {kol?.main_platform ? (
        <span className={`kol-chip ${platformChipClass(kol.main_platform)}`}>{kol.main_platform}</span>
      ) : null}
      {entry.deal_type ? (
        <span className="kol-chip kol-chip-tag">
          {t(KOL_DEAL_TYPES.find(d => d.id === entry.deal_type)?.labelKey || 'hub.campaignKol.dealOther')}
        </span>
      ) : null}
      {entry.publish_status === 'published' ? (
        <span className="kol-chip kol-chip-status">{t('hub.campaignKol.publishDone')}</span>
      ) : null}
    </button>
  );
}

export default function CampaignKolWorkspace({
  campaign,
  initialEntries = [],
  initialPoolRecords = [],
  kview = 'board',
}) {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const [entries, setEntries] = useState(initialEntries);
  const [poolRecords] = useState(initialPoolRecords);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newKolOpen, setNewKolOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const columns = useMemo(() => campaignKolBoardColumns(t), [t]);
  const grouped = useMemo(() => groupCampaignKolByStatus(entries), [entries]);
  const existingIds = useMemo(() => new Set(entries.map(e => e.kol_notion_page_id)), [entries]);

  const refresh = useCallback(async () => {
    const res = await fetch(API_V1.internalCampaignKol(campaign.id), { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = unwrapData(await res.json());
    setEntries(Array.isArray(data?.entries) ? data.entries : []);
  }, [campaign.id]);

  async function patchEntry(entryId, patch) {
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaignKolEntry(campaign.id, entryId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const data = unwrapData(await res.json());
      if (data?.entry) {
        setEntries(prev => prev.map(e => (e.id === entryId ? data.entry : e)));
        if (editing?.id === entryId) setEditing(data.entry);
      } else {
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function addNewKol(payload) {
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaignKol(campaign.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ new_kol: payload }),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const data = unwrapData(await res.json());
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setNewKolOpen(false);
      toast.success(t('hub.campaignKol.createdAndAdded'));
    } finally {
      setBusy(false);
    }
  }

  async function addFromPool(ids) {
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaignKol(campaign.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ kol_ids: ids }),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const data = unwrapData(await res.json());
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setPickerOpen(false);
      toast.success(t('hub.campaignKol.added').replace('{count}', String(data?.created?.length ?? ids.length)));
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(entry) {
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaignKolEntry(campaign.id, entry.id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== entry.id));
        setEditing(null);
      }
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e, statusId) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const entry = entries.find(x => x.id === id);
    if (entry && entry.pipeline_status !== statusId) patchEntry(id, { pipeline_status: statusId });
  }

  const listView = kview === 'list';

  return (
    <section className="campaign-kol-workspace">
      <header className="internal-board-toolbar">
        <Link href={campaignListUrl()} className="internal-board-back">
          <Icon name="arrowLeft" size={14} />
          {t('hub.internal.backToCampaigns')}
        </Link>
        <span className="internal-board-context">{campaign.name}</span>
      </header>

      <div className="internal-dept-toolbar internal-dept-toolbar--board">
        <div className="internal-dept-view-tabs" role="toolbar">
          <Link
            href={campaignKolUrl(campaign.id, 'board')}
            className={`internal-dept-view-tab${!listView ? ' is-active' : ''}`}
          >
            <Icon name="kanban" size={15} />
            {t('hub.internal.viewBoard')}
          </Link>
          <Link
            href={campaignKolUrl(campaign.id, 'list')}
            className={`internal-dept-view-tab${listView ? ' is-active' : ''}`}
          >
            <Icon name="layout" size={15} />
            {t('hub.internal.viewList')}
          </Link>
        </div>
        <div className="kol-pool-header-actions wrap-row">
          <button type="button" className="appdev-btn-ghost" onClick={() => setPickerOpen(true)} disabled={busy}>
            <Icon name="users" size={16} />
            {t('hub.campaignKol.addFromPool')}
          </button>
          <button type="button" className="appdev-btn-primary" onClick={() => setNewKolOpen(true)} disabled={busy}>
            <Icon name="plus" size={16} />
            {t('hub.campaignKol.addNewKol')}
          </button>
        </div>
      </div>

      <p className="kol-pool-notice personal-hub-hint">{t('hub.campaignKol.humanHint')}</p>

      {entries.length === 0 ? (
        <p className="internal-empty">{t('hub.campaignKol.empty')}</p>
      ) : listView ? (
        <div className="campaign-kol-list-wrap h-scroll">
          <table className="kol-pool-table campaign-kol-table">
            <thead>
              <tr>
                <th>{t('hub.kol.colChannel')}</th>
                <th>{t('hub.campaignKol.colStatus')}</th>
                <th>{t('hub.campaignKol.colDealType')}</th>
                <th>{t('hub.campaignKol.colApproachDate')}</th>
                <th>{t('hub.campaignKol.colSocials')}</th>
                <th>{t('hub.campaignKol.colShipping')}</th>
                <th>{t('hub.campaignKol.colArrival')}</th>
                <th>{t('hub.campaignKol.colPublish')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} onClick={() => setEditing(entry)} className="campaign-kol-row-click">
                  <td>{entry.kol?.channel_name || '—'}</td>
                  <td>{t(KOL_PIPELINE_STATUSES.find(s => s.id === entry.pipeline_status)?.labelKey || '')}</td>
                  <td>
                    {entry.deal_type
                      ? t(KOL_DEAL_TYPES.find(d => d.id === entry.deal_type)?.labelKey || '')
                      : '—'}
                  </td>
                  <td>{formatDate(entry.approach_date, locale)}</td>
                  <td>{entry.socials_approached?.join(', ') || '—'}</td>
                  <td>
                    {entry.shipping_date ? formatDate(entry.shipping_date, locale) : '—'}
                    {entry.tracking_link ? (
                      <>
                        {' · '}
                        <a href={entry.tracking_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                          {t('hub.campaignKol.tracking')}
                        </a>
                      </>
                    ) : null}
                  </td>
                  <td>{formatDate(entry.arrival_date, locale)}</td>
                  <td>{t(KOL_PUBLISH_STATUSES.find(p => p.id === entry.publish_status)?.labelKey || '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="internal-board campaign-kol-board">
          {columns.map(col => (
            <div
              key={col.id}
              className={`internal-board-col is-${col.id}${overCol === col.id ? ' is-drop-target' : ''}`}
              onDragOver={e => { e.preventDefault(); setOverCol(col.id); }}
              onDragLeave={() => setOverCol(c => (c === col.id ? null : c))}
              onDrop={e => onDrop(e, col.id)}
            >
              <header className="internal-board-col-head">
                <span>{col.label}</span>
                <span className="internal-board-col-count">{grouped[col.id]?.length || 0}</span>
              </header>
              <ul className="internal-board-col-list">
                {(grouped[col.id] || []).map(entry => (
                  <li
                    key={entry.id}
                    draggable
                    onDragStart={e => {
                      setDragId(entry.id);
                      e.dataTransfer.setData('text/plain', entry.id);
                    }}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  >
                    <CampaignKolCard entry={entry} onEdit={setEditing} t={t} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div className="kol-modal-backdrop" role="presentation" onClick={() => setEditing(null)}>
          <div className="kol-modal kol-modal--wide" role="dialog" onClick={e => e.stopPropagation()}>
            <header className="kol-modal-head">
              <h3>{editing.kol?.channel_name || t('hub.campaignKol.editEntry')}</h3>
              <button type="button" className="appdev-btn-ghost" onClick={() => setEditing(null)}>
                <Icon name="x" size={16} />
              </button>
            </header>
            <form
              className="kol-edit-form"
              onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                patchEntry(editing.id, {
                  pipeline_status: fd.get('pipeline_status'),
                  deal_type: fd.get('deal_type'),
                  approach_date: fd.get('approach_date') || null,
                  socials_approached: String(fd.get('socials_approached') || '').split(/[,;|\n]/).map(s => s.trim()).filter(Boolean),
                  shipping_date: fd.get('shipping_date') || null,
                  tracking_link: fd.get('tracking_link'),
                  arrival_date: fd.get('arrival_date') || null,
                  publish_status: fd.get('publish_status'),
                  notes: fd.get('notes'),
                });
              }}
            >
              <label>
                {t('hub.campaignKol.colStatus')}
                <select name="pipeline_status" defaultValue={editing.pipeline_status}>
                  {KOL_PIPELINE_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{t(s.labelKey)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('hub.campaignKol.colDealType')}
                <select name="deal_type" defaultValue={editing.deal_type}>
                  <option value="">—</option>
                  {KOL_DEAL_TYPES.map(d => (
                    <option key={d.id} value={d.id}>{t(d.labelKey)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('hub.campaignKol.colApproachDate')}
                <input type="date" name="approach_date" defaultValue={editing.approach_date?.slice(0, 10) || ''} />
              </label>
              <label>
                {t('hub.campaignKol.colSocials')}
                <input name="socials_approached" defaultValue={editing.socials_approached?.join(', ') || ''} placeholder="Instagram, YouTube" />
              </label>
              <label>
                {t('hub.campaignKol.colShipping')}
                <input type="date" name="shipping_date" defaultValue={editing.shipping_date?.slice(0, 10) || ''} />
              </label>
              <label>
                {t('hub.campaignKol.trackingLink')}
                <input name="tracking_link" defaultValue={editing.tracking_link || ''} />
              </label>
              <label>
                {t('hub.campaignKol.colArrival')}
                <input type="date" name="arrival_date" defaultValue={editing.arrival_date?.slice(0, 10) || ''} />
              </label>
              <label>
                {t('hub.campaignKol.colPublish')}
                <select name="publish_status" defaultValue={editing.publish_status}>
                  {KOL_PUBLISH_STATUSES.map(p => (
                    <option key={p.id} value={p.id}>{t(p.labelKey)}</option>
                  ))}
                </select>
              </label>
              <label className="kol-edit-form-full">
                {t('hub.campaignKol.notes')}
                <textarea name="notes" rows={3} defaultValue={editing.notes || ''} />
              </label>
              <footer className="kol-modal-foot">
                <button type="button" className="appdev-btn-ghost is-danger" onClick={() => removeEntry(editing)} disabled={busy}>
                  {t('hub.internal.taskPanel.delete')}
                </button>
                <button type="button" className="appdev-btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
                <button type="submit" className="appdev-btn-primary" disabled={busy}>{t('hub.internal.taskPanel.save')}</button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      <KolPickerModal
        open={pickerOpen}
        poolRecords={poolRecords}
        existingIds={existingIds}
        onClose={() => setPickerOpen(false)}
        onAdd={addFromPool}
        busy={busy}
      />

      {newKolOpen ? (
        <KolPoolFormPanel
          mode="create"
          compact
          onClose={() => setNewKolOpen(false)}
          onCreateAndAdd={addNewKol}
        />
      ) : null}
    </section>
  );
}
