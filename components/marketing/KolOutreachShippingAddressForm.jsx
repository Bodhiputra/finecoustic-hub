'use client';

import { useLocale } from '@/components/LocaleProvider';

const FIELDS = [
  { key: 'shipping_line1', labelKey: 'hub.kol.shippingLine1', required: true },
  { key: 'shipping_line2', labelKey: 'hub.kol.shippingLine2' },
  { key: 'shipping_city', labelKey: 'hub.kol.shippingCity', required: true },
  { key: 'shipping_state', labelKey: 'hub.kol.shippingState' },
  { key: 'shipping_postal', labelKey: 'hub.kol.shippingPostal' },
  { key: 'shipping_country', labelKey: 'hub.kol.shippingCountry', required: true },
  { key: 'shipping_phone', labelKey: 'hub.kol.shippingPhone' },
  { key: 'shipping_email', labelKey: 'hub.kol.shippingEmail', type: 'email' },
  { key: 'shipping_notes', labelKey: 'hub.kol.shippingNotes', span: 2, textarea: true },
];

export function emptyShippingForm() {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, '']));
}

export function shippingFormFromRecord(record = {}) {
  return Object.fromEntries(
    FIELDS.map(({ key }) => [key, String(record?.[key] || '').trim()])
  );
}

export function isShippingFormComplete(form = {}) {
  return Boolean(
    String(form.shipping_line1 || '').trim()
    && String(form.shipping_city || '').trim()
    && String(form.shipping_country || '').trim()
  );
}

export default function KolOutreachShippingAddressForm({ value, onChange, disabled = false }) {
  const { t } = useLocale();

  function setField(key, next) {
    onChange?.({ ...value, [key]: next });
  }

  return (
    <div className="kol-shipping-address-form">
      <p className="kol-shipping-address-hint">{t('hub.campaignKol.shippingAddressRequired')}</p>
      <div className="kol-shipping-address-grid">
        {FIELDS.map(({ key, labelKey, required, type, span, textarea }) => (
          <label
            key={key}
            className={`appdev-field${span === 2 ? ' kol-shipping-span-2' : ''}`}
          >
            <span>
              {t(labelKey)}
              {required ? ' *' : null}
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
                onChange={e => setField(key, e.target.value)}
                disabled={disabled}
                required={required}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
