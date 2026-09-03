'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import {
  normalizeKolOrderNumberField,
  suggestNextKolOrderNumber,
  validateKolOrderNumber,
} from '@/lib/kol-outreach-shared';

export function kolOrderNumberErrorMessage(validation, t) {
  if (!validation || validation.ok) return '';
  if (validation.code === 'duplicate') {
    return t('hub.campaignKol.orderNumberDuplicate')
      .replace('{number}', validation.normalized || '')
      .replace('{name}', validation.conflict?.title || '—');
  }
  return '';
}

export default function KolOutreachOrderNumberField({
  value,
  onChange,
  outreachTasks = [],
  excludeTaskId = null,
  disabled = false,
}) {
  const { t } = useLocale();

  const suggested = useMemo(
    () => suggestNextKolOrderNumber(outreachTasks),
    [outreachTasks]
  );

  const validation = useMemo(() => {
    if (!String(value || '').trim()) return { ok: true };
    return validateKolOrderNumber(value, outreachTasks, excludeTaskId);
  }, [value, outreachTasks, excludeTaskId]);

  const errorMessage = kolOrderNumberErrorMessage(validation, t);

  function handleBlur() {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    const normalized = normalizeKolOrderNumberField(trimmed);
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
          aria-invalid={Boolean(errorMessage)}
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
      {errorMessage ? <p className="kol-order-number-error">{errorMessage}</p> : null}
    </label>
  );
}
