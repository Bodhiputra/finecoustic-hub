'use client';

import { useCallback } from 'react';
import Icon from '@/components/Icon';
import KolModal from '@/components/KolModal';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { kolShippingDetailEntries, kolShippingDetailText } from '@/lib/kol-pool';

export default function KolPoolShippingModal({ open, record, onClose }) {
  const { t } = useLocale();
  const { toast } = useToast();

  const entries = kolShippingDetailEntries(record);

  const copyAll = useCallback(async () => {
    const text = kolShippingDetailText(record, key => t(key));
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('hub.kol.shippingCopied'));
    } catch {
      toast.error(t('common.somethingWrong'));
    }
  }, [record, toast, t]);

  if (!open || !record) return null;

  return (
    <KolModal open={open} onClose={onClose} labelledBy="kol-shipping-modal-title">
      <header className="kol-modal-head">
        <div className="kol-modal-head-copy">
          <h3 id="kol-shipping-modal-title">{t('hub.kol.shippingAddress')}</h3>
          <p className="kol-modal-sub">{record.channel_name}</p>
        </div>
        <button type="button" className="appdev-btn-ghost" onClick={onClose} aria-label={t('common.cancel')}>
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="kol-modal-body">
      <div className="kol-shipping-detail">
        {entries.length ? (
          <dl className="kol-shipping-detail-list">
            {entries.map(entry => (
              <div key={entry.key} className="kol-shipping-detail-row">
                <dt>{t(entry.labelKey)}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="kol-shipping-detail-empty">{t('hub.kol.shippingEmpty')}</p>
        )}
      </div>
      </div>

      {entries.length ? (
        <footer className="kol-modal-foot">
          <button type="button" className="appdev-btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="appdev-btn-primary" onClick={copyAll}>
            <Icon name="copy" size={14} />
            {t('hub.kol.shippingCopy')}
          </button>
        </footer>
      ) : null}
    </KolModal>
  );
}
