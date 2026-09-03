'use client';

import { useLocale } from '@/components/LocaleProvider';
import { isValidShippingCountryCode, normalizeShippingCountryCode } from '@/lib/kol-pool';

const FIELDS = [
  {
    key: 'shipping_name',
    labelKey: 'hub.kol.shippingName',
    required: true,
    span: 2,
    placeholderKey: 'hub.kol.shippingNamePlaceholder',
  },
  { key: 'shipping_line1', labelKey: 'hub.kol.shippingLine1', required: true },
  { key: 'shipping_line2', labelKey: 'hub.kol.shippingLine2' },
  { key: 'shipping_city', labelKey: 'hub.kol.shippingCity', required: true },
  { key: 'shipping_state', labelKey: 'hub.kol.shippingState' },
  { key: 'shipping_postal', labelKey: 'hub.kol.shippingPostal' },
  { key: 'shipping_country', labelKey: 'hub.kol.shippingCountry', required: true },
  {
    key: 'shipping_country_code',
    labelKey: 'hub.kol.shippingCountryCode',
    required: true,
    countryCode: true,
    placeholderKey: 'hub.kol.shippingCountryCodePlaceholder',
  },
  { key: 'shipping_phone', labelKey: 'hub.kol.shippingPhone' },
  { key: 'shipping_email', labelKey: 'hub.kol.shippingEmail', type: 'email' },
  {
    key: 'shipping_tax_id',
    labelKey: 'hub.kol.shippingTaxId',
    hintKey: 'hub.kol.shippingTaxIdHint',
    span: 2,
    placeholderKey: 'hub.kol.shippingTaxIdPlaceholder',
  },
];

export function emptyShippingForm() {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, '']));
}

export function shippingFormFromRecord(record = {}, { fallbackName = '' } = {}) {
  const form = Object.fromEntries(
    FIELDS.map(({ key, countryCode }) => [
      key,
      countryCode
        ? normalizeShippingCountryCode(record?.[key])
        : String(record?.[key] || '').trim(),
    ])
  );
  if (!form.shipping_name) {
    form.shipping_name = String(record?.channel_name || fallbackName || '').trim();
  }
  return form;
}

export function isShippingFormComplete(form = {}) {
  return Boolean(
    String(form.shipping_name || '').trim()
    && String(form.shipping_line1 || '').trim()
    && String(form.shipping_city || '').trim()
    && String(form.shipping_country || '').trim()
    && isValidShippingCountryCode(form.shipping_country_code)
  );
}

export default function KolOutreachShippingAddressForm({ value, onChange, disabled = false }) {
  const { t } = useLocale();

  function setField(key, next, { countryCode = false } = {}) {
    onChange?.({
      ...value,
      [key]: countryCode ? normalizeShippingCountryCode(next) : next,
    });
  }

  return (
    <div className="kol-shipping-address-form">
      <p className="kol-shipping-address-hint">{t('hub.campaignKol.shippingAddressRequired')}</p>
      <div className="kol-shipping-address-grid">
        {FIELDS.map(({ key, labelKey, required, type, span, textarea, countryCode, placeholderKey, hintKey }) => (
          <label
            key={key}
            className={`appdev-field${span === 2 ? ' kol-shipping-span-2' : ''}${countryCode ? ' kol-shipping-country-code' : ''}`}
          >
            <span>
              {t(labelKey)}
              {required ? ' *' : null}
              {hintKey ? <span className="kol-shipping-field-hint">{t(hintKey)}</span> : null}
            </span>
            {textarea ? (
              <textarea
                rows={2}
                value={value?.[key] || ''}
                onChange={e => setField(key, e.target.value)}
                disabled={disabled}
              />
            ) : (
              <input
                type={type || 'text'}
                value={value?.[key] || ''}
                onChange={e => setField(key, e.target.value, { countryCode })}
                disabled={disabled}
                required={required}
                maxLength={countryCode ? 2 : undefined}
                placeholder={placeholderKey ? t(placeholderKey) : undefined}
                className={countryCode ? 'kol-shipping-country-code-input' : undefined}
                autoComplete={countryCode ? 'country' : undefined}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
