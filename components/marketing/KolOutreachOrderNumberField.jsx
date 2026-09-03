'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import {
  formatKolOrderNumber,
  latestKolOrderNumberSequence,
  normalizeKolOrderNumber,
  suggestNextKolOrderNumber,
} from '@/lib/kol-outreach-shared';

export default function KolOutreachOrderNumberField({
  value,
  onChange,
  outreachTasks = [],
  disabled = false,
  hintKey = 'hub.campaignKol.orderNumberWeibinHint',
}) {
  const { t } = useLocale();

  const latestSeq = useMemo(
    () => latestKolOrderNumberSequence(outreachTasks),
    [outreachTasks]
  );
  const latestLabel = latestSeq > 0 ? formatKolOrderNumber(latestSeq) : null;
  const suggested = useMemo(
    () => suggestNextKolOrderNumber(outreachTasks),
    [outreachTasks]
  );

  function handleBlur() {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    const normalized = normalizeKolOrderNumber(trimmed);
    if (normalized && normalized !== trimmed) onChange?.(normalized);
  }

  const registryHint = latestLabel
    ? t('hub.campaignKol.orderNumberRegistry')
      .replace('{latest}', latestLabel)
      .replace('{next}', suggested)
    : t('hub.campaignKol.orderNumberRegistryEmpty').replace('{next}', suggested);

  return (
    <label className="appdev-field kol-order-number-field">
      <span>{t('hub.campaignKol.orderNumber')}</span>
      {hintKey ? <span className="kol-shipping-field-hint">{t(hintKey)}</span> : null}
      <p className="kol-order-number-registry-hint">{registryHint}</p>
      <div className="kol-order-number-input-row">
        <input
          value={value || ''}
          onChange={e => onChange?.(e.target.value)}
          onBlur={handleBlur}
          placeholder={t('hub.campaignKol.orderNumberPlaceholder')}
          disabled={disabled}
        />
        <button
          type="button"
          className="hub-btn hub-btn--ghost kol-order-number-use-next"
          onClick={() => onChange?.(suggested)}
          disabled={disabled}
        >
          {t('hub.campaignKol.orderNumberUseNext').replace('{next}', suggested)}
        </button>
      </div>
    </label>
  );
}
