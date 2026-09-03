'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import {
  normalizeKolOrderNumber,
  suggestNextKolOrderNumber,
} from '@/lib/kol-outreach-shared';

export default function KolOutreachOrderNumberField({
  value,
  onChange,
  outreachTasks = [],
  disabled = false,
}) {
  const { t } = useLocale();

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

  return (
    <label className="appdev-field kol-order-number-field">
      <span>{t('hub.campaignKol.orderNumber')}</span>
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
