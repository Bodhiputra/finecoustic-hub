'use client';

import { useEffect, useState } from 'react';
import KolPoolFormPanel from '@/components/marketing/KolPoolFormPanel';
import KolModal from '@/components/KolModal';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { taskPoolId } from '@/lib/kol-outreach-utils';

/** Loads pool record then opens the shared KOL pool editor (writes to KOL pool). */
export default function KolOutreachMoreInfoModal({ open, task, poolRecord: poolRecordIn, onClose, onSaved }) {
  const { t } = useLocale();
  const [record, setRecord] = useState(poolRecordIn || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const poolId = taskPoolId(task);
    if (poolRecordIn?.notion_page_id === poolId) {
      setRecord(poolRecordIn);
      return undefined;
    }
    if (!poolId) {
      setRecord(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetch(API_V1.marketingKolPoolRecord(poolId), { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (cancelled) return;
        const data = unwrapData(body);
        setRecord(data?.record || data || null);
      })
      .catch(() => {
        if (!cancelled) setRecord(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, task, poolRecordIn]);

  if (!open) return null;

  if (loading) {
    return (
      <KolModal open onClose={onClose} labelledBy="kol-outreach-loading">
        <p id="kol-outreach-loading">{t('common.loading')}</p>
      </KolModal>
    );
  }

  if (!record) {
    return (
      <KolModal open onClose={onClose} labelledBy="kol-outreach-missing">
        <p id="kol-outreach-missing">{t('hub.campaignKol.poolRecordMissing')}</p>
      </KolModal>
    );
  }

  return (
    <KolPoolFormPanel
      mode="edit"
      record={record}
      onClose={onClose}
      onSaved={saved => {
        setRecord(saved);
        onSaved?.(saved);
      }}
    />
  );
}
