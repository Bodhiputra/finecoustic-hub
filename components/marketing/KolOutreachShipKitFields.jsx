'use client';

import { useLocale } from '@/components/LocaleProvider';

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <label className="kol-toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`kol-toggle${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="kol-toggle-thumb" aria-hidden="true" />
      </button>
    </label>
  );
}

export default function KolOutreachShipKitFields({
  orderNumber,
  onOrderNumberChange,
  mediaKitLink,
  onMediaKitLinkChange,
  mediaKitSent,
  onMediaKitSentChange,
  trackingLink,
  onTrackingLinkChange,
  trackingSent,
  onTrackingSentChange,
  shippingDate,
  onShippingDateChange,
  disabled = false,
  requireShippingDate = false,
}) {
  const { t } = useLocale();

  return (
    <div className="kol-ship-kit-fields">
      {onShippingDateChange ? (
        <label className="appdev-field">
          <span>{t('hub.campaignKol.colShipping')}</span>
          <input
            type="date"
            value={shippingDate || ''}
            onChange={e => onShippingDateChange(e.target.value)}
            disabled={disabled}
            required={requireShippingDate}
          />
        </label>
      ) : null}

      <label className="appdev-field">
        <span>{t('hub.campaignKol.orderNumber')}</span>
        <input
          value={orderNumber || ''}
          onChange={e => onOrderNumberChange?.(e.target.value)}
          placeholder={t('hub.campaignKol.orderNumberPlaceholder')}
          disabled={disabled}
        />
      </label>

      <label className="appdev-field">
        <span>{t('hub.campaignKol.mediaKitLink')}</span>
        <input
          type="url"
          value={mediaKitLink || ''}
          onChange={e => onMediaKitLinkChange?.(e.target.value)}
          placeholder={t('hub.campaignKol.mediaKitLinkPlaceholder')}
          disabled={disabled}
        />
      </label>
      <ToggleRow
        label={t('hub.campaignKol.mediaKitSent')}
        checked={Boolean(mediaKitSent)}
        onChange={onMediaKitSentChange}
        disabled={disabled}
      />

      <label className="appdev-field">
        <span>{t('hub.campaignKol.trackingLink')}</span>
        <input
          type="url"
          value={trackingLink || ''}
          onChange={e => onTrackingLinkChange?.(e.target.value)}
          placeholder={t('hub.campaignKol.trackingLinkPlaceholder')}
          disabled={disabled}
        />
      </label>
      <ToggleRow
        label={t('hub.campaignKol.trackingSent')}
        checked={Boolean(trackingSent)}
        onChange={onTrackingSentChange}
        disabled={disabled}
      />
    </div>
  );
}
