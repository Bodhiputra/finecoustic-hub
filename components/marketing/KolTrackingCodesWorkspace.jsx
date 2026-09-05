'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import ButtonBusyContent from '@/components/ButtonBusyContent';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { filterVisibleKolPool } from '@/lib/kol-pool';
import KolPoolSearchSelect from '@/components/marketing/KolPoolSearchSelect';

function formatWhen(iso, locale = 'en') {
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

function CopyCodeButton({ code, label }) {
  const { toast } = useToast();
  const { t } = useLocale();

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t('hub.kolTracking.copied'));
    } catch {
      toast.error(t('common.somethingWrong'));
    }
  }, [code, toast, t]);

  return (
    <button type="button" className="kol-tracking-copy" onClick={copy} aria-label={label}>
      <code className="kol-tracking-code">{code}</code>
      <Icon name="copy" size={14} />
    </button>
  );
}

export default function KolTrackingCodesWorkspace({ initialPoolRecords = [] }) {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedKolId, setSelectedKolId] = useState('');

  const poolRecords = useMemo(
    () => filterVisibleKolPool(initialPoolRecords),
    [initialPoolRecords]
  );

  const codedKolIds = useMemo(() => new Set(entries.map(entry => entry.kol_pool_id)), [entries]);

  const kolOptions = useMemo(
    () =>
      [...poolRecords]
        .sort((a, b) => String(a.channel_name || '').localeCompare(String(b.channel_name || '')))
        .map(record => ({
          id: record.notion_page_id,
          label: record.channel_name || record.notion_page_id,
          platform: record.main_platform || '',
          hasCode: codedKolIds.has(record.notion_page_id),
        })),
    [poolRecords, codedKolIds]
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_V1.marketingKolTrackingCodes);
      if (!res.ok) throw new Error('load_failed');
      const body = await res.json();
      const data = unwrapData(body);
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setLoaded(true);
    } catch {
      toast.error(t('hub.kolTracking.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(entry =>
      [entry.code, entry.channel_name, entry.platform, entry.created_by, entry.notes]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [entries, query]);

  const selectedHasCode = selectedKolId ? codedKolIds.has(selectedKolId) : false;

  const generate = async () => {
    if (!selectedKolId) {
      toast.error(t('hub.kolTracking.pickKol'));
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(API_V1.marketingKolTrackingCodes, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kol_pool_id: selectedKolId }),
      });
      const body = await res.json();
      if (!res.ok) {
        const err = body?.error || 'create_failed';
        const key = `hub.kolTracking.errors.${err}`;
        const msg = t(key);
        toast.error(msg !== key ? msg : err);
        return;
      }
      const data = unwrapData(body);
      const entry = data?.entry;
      if (entry) {
        setEntries(prev => {
          const without = prev.filter(row => row.kol_pool_id !== entry.kol_pool_id);
          return [entry, ...without];
        });
        if (data.created) {
          toast.success(t('hub.kolTracking.created', { code: entry.code }));
        } else {
          toast(t('hub.kolTracking.alreadyExists', { code: entry.code }));
        }
      }
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setGenerating(false);
    }
  };

  const removeEntry = async id => {
    if (!window.confirm(t('hub.kolTracking.deleteConfirm'))) return;
    try {
      const res = await fetch(API_V1.marketingKolTrackingCode(id), { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      setEntries(prev => prev.filter(entry => entry.id !== id));
      toast.success(t('hub.kolTracking.deleted'));
    } catch {
      toast.error(t('common.somethingWrong'));
    }
  };

  return (
    <div className="kol-pool-workspace kol-tracking-workspace">
      <header className="kol-pool-header wrap-row">
        <div className="kol-pool-header-copy">
          <h2 className="kol-pool-title">{t('hub.kolTracking.title')}</h2>
          <p className="kol-pool-subtitle">{t('hub.kolTracking.subtitle')}</p>
        </div>
      </header>

      <section className="kol-tracking-panel" aria-labelledby="kol-tracking-generate-title">
        <h3 id="kol-tracking-generate-title" className="kol-tracking-section-title">
          {t('hub.kolTracking.generateTitle')}
        </h3>
        <p className="kol-tracking-hint">{t('hub.kolTracking.generateHint')}</p>
        <div className="kol-tracking-generator-row wrap-row">
          <KolPoolSearchSelect
            label={t('hub.kolTracking.pickKolLabel')}
            placeholder={t('hub.kolTracking.pickKolPlaceholder')}
            options={kolOptions}
            value={selectedKolId}
            onChange={setSelectedKolId}
          />
          <button
            type="button"
            className="hub-btn hub-btn--primary"
            disabled={!selectedKolId || generating}
            onClick={generate}
          >
            <ButtonBusyContent busy={generating} busyLabel={t('hub.kolTracking.generating')}>
              {selectedHasCode ? t('hub.kolTracking.showCode') : t('hub.kolTracking.generate')}
            </ButtonBusyContent>
          </button>
        </div>
        {selectedHasCode ? (
          <p className="kol-tracking-note">{t('hub.kolTracking.onePerKol')}</p>
        ) : null}
      </section>

      <section className="kol-tracking-panel" aria-labelledby="kol-tracking-registry-title">
        <div className="kol-tracking-registry-head wrap-row">
          <h3 id="kol-tracking-registry-title" className="kol-tracking-section-title">
            {t('hub.kolTracking.registryTitle')}
          </h3>
          <div className="kol-tracking-registry-tools wrap-row">
            <label className="kol-pool-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('hub.kolTracking.searchPlaceholder')}
                aria-label={t('hub.kolTracking.searchPlaceholder')}
              />
            </label>
            <button type="button" className="hub-btn hub-btn--ghost" onClick={loadEntries} disabled={loading}>
              <Icon name="refresh" size={16} />
              <ButtonBusyContent busy={loading} busyLabel={t('common.loading')}>
                {t('hub.kolTracking.refresh')}
              </ButtonBusyContent>
            </button>
          </div>
        </div>

        {!filteredEntries.length ? (
          <p className="internal-empty personal-hub-hint">
            {loaded ? t('hub.kolTracking.empty') : t('common.loading')}
          </p>
        ) : (
          <div className="kol-pool-table-wrap">
            <table className="kol-pool-table kol-tracking-table">
              <thead>
                <tr>
                  <th>{t('hub.kolTracking.colCode')}</th>
                  <th>{t('hub.kolTracking.colChannel')}</th>
                  <th>{t('hub.kol.colPlatform')}</th>
                  <th>{t('hub.kolTracking.colCreated')}</th>
                  <th>{t('hub.kolTracking.colCreatedBy')}</th>
                  <th aria-label={t('hub.kolTracking.colActions')} />
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => (
                  <tr key={entry.id}>
                    <td>
                      <CopyCodeButton
                        code={entry.code}
                        label={t('hub.kolTracking.copyCode', { code: entry.code })}
                      />
                    </td>
                    <td>{entry.channel_name || '—'}</td>
                    <td>{entry.platform || '—'}</td>
                    <td>{formatWhen(entry.created_at, locale)}</td>
                    <td>{entry.created_by || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="hub-btn hub-btn--ghost hub-btn--sm kol-tracking-delete"
                        onClick={() => removeEntry(entry.id)}
                      >
                        {t('hub.kolTracking.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
