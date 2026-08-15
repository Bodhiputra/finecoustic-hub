'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  KOL_PLATFORM_SUGGESTIONS,
  KOL_TAG_SUGGESTIONS,
  isHubNativeKol,
  kolRecordSourceLabel,
  kolShippingSummary,
} from '@/lib/kol-pool';

function formPayload(fd) {
  const collabRaw = String(fd.get('collaboration_products') || '');
  return {
    channel_name: fd.get('channel_name'),
    description: fd.get('description'),
    links: fd.get('links'),
    main_platform: fd.get('main_platform'),
    country: fd.get('country'),
    kol_category: fd.get('kol_category'),
    tags: fd.get('tags'),
    outreach_status: fd.get('outreach_status'),
    shipping_line1: fd.get('shipping_line1'),
    shipping_line2: fd.get('shipping_line2'),
    shipping_city: fd.get('shipping_city'),
    shipping_state: fd.get('shipping_state'),
    shipping_postal: fd.get('shipping_postal'),
    shipping_country: fd.get('shipping_country'),
    shipping_phone: fd.get('shipping_phone'),
    shipping_notes: fd.get('shipping_notes'),
    collaboration_products: collabRaw.split(/[,;|\n]/).map(s => s.trim()).filter(Boolean),
  };
}

export default function KolPoolFormPanel({
  mode = 'edit',
  record = null,
  compact = false,
  onClose,
  onSaved,
  onCreateAndAdd = null,
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const isCreate = mode === 'create';
  const data = record || {};

  if (!isCreate && !record) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = formPayload(new FormData(e.currentTarget));

      if (isCreate && onCreateAndAdd) {
        await onCreateAndAdd(payload);
        return;
      }

      const res = await fetch(
        isCreate ? API_V1.marketingKolPool : API_V1.marketingKolPoolRecord(data.notion_page_id),
        {
          method: isCreate ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === 'channel_name_required') {
          toast.error(t('hub.kol.channelRequired'));
          return;
        }
        toast.error(t('common.somethingWrong'));
        return;
      }

      const result = unwrapData(await res.json());
      toast.success(isCreate ? t('hub.kol.created') : t('hub.kol.saved'));
      onSaved?.(result?.record || null);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kol-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="kol-modal kol-modal--wide" role="dialog" onClick={e => e.stopPropagation()}>
        <header className="kol-modal-head">
          <div>
            <h3>{isCreate ? t('hub.kol.addKol') : data.channel_name}</h3>
            <p className="kol-modal-sub">
              {isCreate
                ? t('hub.kol.addKolHint')
                : kolRecordSourceLabel(data, t)}
              {!isCreate && !isHubNativeKol(data) ? (
                <span> · {t('hub.kol.notionEditHint')}</span>
              ) : null}
            </p>
          </div>
          <button type="button" className="appdev-btn-ghost" onClick={onClose} aria-label={t('common.cancel')}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <form className="kol-edit-form" onSubmit={handleSubmit}>
          <fieldset>
            <legend>{t('hub.kol.sectionProfile')}</legend>
            <label className="kol-edit-form-full">
              {t('hub.kol.colChannel')} *
              <input
                name="channel_name"
                required
                defaultValue={data.channel_name || ''}
                placeholder={t('hub.kol.channelPlaceholder')}
              />
            </label>
            <label>
              {t('hub.kol.colPlatform')}
              <input
                name="main_platform"
                list="kol-platform-options"
                defaultValue={data.main_platform || ''}
                placeholder={t('hub.kol.platformPlaceholder')}
              />
            </label>
            <label>
              {t('hub.kol.colCountry')}
              <input name="country" defaultValue={data.country || ''} placeholder={t('hub.kol.countryPlaceholder')} />
            </label>
            <label>
              {t('hub.kol.colTier')}
              <input name="kol_category" defaultValue={data.kol_category || ''} placeholder={t('hub.kol.tierPlaceholder')} />
            </label>
            <label>
              {t('hub.kol.colTags')}
              <input
                name="tags"
                list="kol-tag-options"
                defaultValue={data.tags || (isCreate ? 'stored' : '')}
                placeholder={t('hub.kol.tagsPlaceholder')}
              />
            </label>
            {!compact ? (
              <label>
                {t('hub.kol.colStatus')}
                <input name="outreach_status" defaultValue={data.outreach_status || ''} />
              </label>
            ) : null}
            <label className="kol-edit-form-full">
              {t('hub.kol.colDescription')}
              <textarea
                name="description"
                rows={2}
                defaultValue={data.description || ''}
                placeholder={t('hub.kol.descriptionPlaceholder')}
              />
            </label>
            <label className="kol-edit-form-full">
              {t('hub.kol.colLinks')}
              <input
                name="links"
                type="url"
                defaultValue={data.links || ''}
                placeholder={t('hub.kol.linksPlaceholder')}
              />
            </label>
          </fieldset>

          {!compact ? (
            <>
              <fieldset>
                <legend>{t('hub.kol.shippingAddress')}</legend>
                <label>
                  {t('hub.kol.shippingLine1')}
                  <input name="shipping_line1" defaultValue={data.shipping_line1 || ''} />
                </label>
                <label>
                  {t('hub.kol.shippingLine2')}
                  <input name="shipping_line2" defaultValue={data.shipping_line2 || ''} />
                </label>
                <label>
                  {t('hub.kol.shippingCity')}
                  <input name="shipping_city" defaultValue={data.shipping_city || ''} />
                </label>
                <label>
                  {t('hub.kol.shippingState')}
                  <input name="shipping_state" defaultValue={data.shipping_state || ''} />
                </label>
                <label>
                  {t('hub.kol.shippingPostal')}
                  <input name="shipping_postal" defaultValue={data.shipping_postal || ''} />
                </label>
                <label>
                  {t('hub.kol.shippingCountry')}
                  <input name="shipping_country" defaultValue={data.shipping_country || ''} />
                </label>
                <label>
                  {t('hub.kol.shippingPhone')}
                  <input name="shipping_phone" defaultValue={data.shipping_phone || ''} />
                </label>
                <label className="kol-edit-form-full">
                  {t('hub.kol.shippingNotes')}
                  <textarea name="shipping_notes" rows={2} defaultValue={data.shipping_notes || ''} />
                </label>
                {kolShippingSummary(data) ? (
                  <p className="kol-edit-summary">{t('hub.kol.currentShipping')}: {kolShippingSummary(data)}</p>
                ) : null}
              </fieldset>
              <label className="kol-edit-form-full">
                {t('hub.kol.collaborationProducts')}
                <textarea
                  name="collaboration_products"
                  rows={2}
                  defaultValue={(data.collaboration_products || []).join(', ')}
                  placeholder={t('hub.kol.collaborationProductsHint')}
                />
              </label>
            </>
          ) : null}

          <datalist id="kol-platform-options">
            {KOL_PLATFORM_SUGGESTIONS.map(p => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <datalist id="kol-tag-options">
            {KOL_TAG_SUGGESTIONS.map(p => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <footer className="kol-modal-foot kol-edit-form-full">
            <button type="button" className="appdev-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="appdev-btn-primary" disabled={busy}>
              {onCreateAndAdd
                ? t('hub.campaignKol.addNewKol')
                : isCreate
                  ? t('hub.kol.saveToPool')
                  : t('hub.internal.taskPanel.save')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
