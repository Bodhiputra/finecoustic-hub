'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import KolModal from '@/components/KolModal';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { KOL_OUTREACH_BOARD_ID, KOL_BOARD_PROP } from '@/lib/kol-outreach-shared';
import { platformChipClass } from '@/lib/kol-pool';
import KolPoolFormPanel from '@/components/marketing/KolPoolFormPanel';

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
    <KolModal open={open} onClose={onClose} labelledBy="kol-picker-title">
      <header className="kol-modal-head">
        <h3 id="kol-picker-title">{t('hub.campaignKol.addFromPool')}</h3>
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
    </KolModal>
  );
}

export default function KolOutreachBoardActions({
  tasks = [],
  initialPoolRecords = [],
  onTasksChanged,
  canCreate = false,
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newKolOpen, setNewKolOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [poolRecords, setPoolRecords] = useState(initialPoolRecords);

  useEffect(() => {
    if (initialPoolRecords.length) return;
    fetch(API_V1.marketingKolPool, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const data = unwrapData(body);
        const records = Array.isArray(data?.records) ? data.records : [];
        if (records.length) setPoolRecords(records);
      })
      .catch(() => {});
  }, [initialPoolRecords.length]);

  const existingIds = useMemo(
    () => new Set(
      tasks
        .map(task => task.custom_values?.[KOL_BOARD_PROP.kolPoolId])
        .filter(Boolean)
    ),
    [tasks]
  );

  const createTaskForKol = useCallback(async (kol) => {
    const res = await fetch(API_V1.internalTasks, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        title: kol.channel_name || kol.notion_page_id || 'KOL',
        department: 'marketing',
        board_id: KOL_OUTREACH_BOARD_ID,
        subtype: 'kol',
        status: 'not_started',
        custom_values: {
          [KOL_BOARD_PROP.kolPoolId]: kol.notion_page_id,
        },
      }),
    });
    if (!res.ok) throw new Error('create_failed');
    const body = await res.json();
    return unwrapData(body, 'task')?.task || unwrapData(body);
  }, []);

  async function addFromPool(ids) {
    setBusy(true);
    try {
      let created = 0;
      for (const id of ids) {
        const kol = poolRecords.find(r => r.notion_page_id === id);
        if (!kol || existingIds.has(id)) continue;
        await createTaskForKol(kol);
        created += 1;
      }
      setPickerOpen(false);
      if (created) {
        toast.success(t('hub.campaignKol.added').replace('{count}', String(created)));
        await onTasksChanged?.();
      }
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  async function addNewKol(payload) {
    setBusy(true);
    try {
      const res = await fetch(API_V1.marketingKolPool, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const data = unwrapData(await res.json());
      const kol = data?.record || data;
      if (!kol?.notion_page_id) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      await createTaskForKol(kol);
      setNewKolOpen(false);
      toast.success(t('hub.campaignKol.createdAndAdded'));
      await onTasksChanged?.();
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  if (!canCreate) return null;

  return (
    <>
      <button type="button" className="appdev-btn-ghost" onClick={() => setPickerOpen(true)} disabled={busy}>
        <Icon name="users" size={16} />
        {t('hub.campaignKol.addFromPool')}
      </button>
      <button type="button" className="appdev-btn-primary" onClick={() => setNewKolOpen(true)} disabled={busy}>
        <Icon name="plus" size={16} />
        {t('hub.campaignKol.addNewKol')}
      </button>

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
    </>
  );
}
