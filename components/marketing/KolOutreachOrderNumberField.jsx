'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import {
  formatKolOrderNumber,
  latestKolOrderNumberSequence,
  normalizeKolOrderNumber,
  suggestNextKolOrderNumber,
  validateKolOrderNumber,
} from '@/lib/kol-outreach-shared';

export function kolOrderNumberErrorMessage(validation, t) {
  if (!validation || validation.ok) return '';
  if (validation.code === 'required') return t('hub.campaignKol.orderNumberRequired');
  if (validation.code === 'invalid_format') return t('hub.campaignKol.orderNumberInvalidFormat');
  if (validation.code === 'duplicate') {
    return t('hub.campaignKol.orderNumberDuplicate')
      .replace('{number}', validation.normalized || '')
      .replace('{name}', validation.conflict?.title || '—');
  }
  if (validation.code === 'reserved') {
    return t('hub.campaignKol.orderNumberReserved')
      .replace('{latest}', formatKolOrderNumber(validation.floor || 0))
      .replace('{next}', validation.next || '');
  }
  return t('hub.campaignKol.orderNumberInvalidFormat');
}

export default function KolOutreachOrderNumberField({
  value,
  onChange,
  outreachTasks = [],
  excludeTaskId = null,
  disabled = false,
  required = false,
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

  const validation = useMemo(() => {
    if (!String(value || '').trim()) {
      return required ? { ok: false, code: 'required' } : { ok: true };
    }
    return validateKolOrderNumber(value, outreachTasks, excludeTaskId);
  }, [value, outreachTasks, excludeTaskId, required]);

  const errorMessage = kolOrderNumberErrorMessage(validation, t);

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
          required={required}
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
