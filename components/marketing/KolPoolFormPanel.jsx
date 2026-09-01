'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import KolModal from '@/components/KolModal';
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
    shipping_line1: fd.get('shipping_line1'),
    shipping_line2: fd.get('shipping_line2'),
    shipping_city: fd.get('shipping_city'),
    shipping_state: fd.get('shipping_state'),
    shipping_postal: fd.get('shipping_postal'),
    shipping_country: fd.get('shipping_country'),
    shipping_phone: fd.get('shipping_phone'),
    shipping_email: fd.get('shipping_email'),
    shipping_notes: fd.get('shipping_notes'),
    collaboration_products: collabRaw.split(/[,;|\n]/).map(s => s.trim()).filter(Boolean),
  };
}

function FormField({ label, required = false, span = 1, children }) {
  return (
    <label className={span === 2 ? 'kol-edit-span-2' : undefined}>
      <span className="kol-edit-label">
        {label}
        {required ? ' *' : null}
      </span>
      {children}
    </label>
  );
}

export default function KolPoolFormPanel({
  mode = 'edit',
  record = null,
  compact = false,
  onClose,
  onSaved,
  onDeleted,
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
        if (body?.error === 'channel_name_duplicate') {
          toast.error(t('hub.kol.channelDuplicate'));
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

  async function handleDelete() {
    if (isCreate || !data?.notion_page_id) return;
    const message = isHubNativeKol(data)
      ? t('hub.kol.deleteConfirm')
      : `${t('hub.kol.deleteConfirm')}\n\n${t('hub.kol.deleteNotionHint')}`;
    if (!window.confirm(message)) return;

    setBusy(true);
    try {
      const res = await fetch(API_V1.marketingKolPoolRecord(data.notion_page_id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      toast.success(t('hub.kol.deleted'));
      onDeleted?.(data.notion_page_id);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <KolModal open wide onClose={onClose} labelledBy="kol-pool-form-title">
      <header className="kol-modal-head">
        <div className="kol-modal-head-copy">
          <h3 id="kol-pool-form-title">{isCreate ? t('hub.kol.addKol') : data.channel_name}</h3>
          <p className="kol-modal-sub">
            {isCreate
              ? t('hub.kol.addKolHint')
              : kolRecordSourceLabel(data, t)}
            {!isCreate && !isHubNativeKol(data) ? (
              <span> · {t('hub.kol.notionEditHint')}</span>
            ) : null}
          </p>
        </div>
        <button type="button" className="appdev-btn-ghost kol-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
          <Icon name="x" size={16} />
        </button>
      </header>

      <form className="kol-edit-form kol-pool-edit-form" onSubmit={handleSubmit}>
        <div className="kol-edit-form-body">
          <section className="kol-edit-section" aria-labelledby="kol-edit-profile-title">
            <h4 id="kol-edit-profile-title" className="kol-edit-section-title">{t('hub.kol.sectionProfile')}</h4>
            <div className="kol-edit-grid">
              <FormField label={t('hub.kol.colChannel')} required span={2}>
                <input
                  name="channel_name"
                  required
                  defaultValue={data.channel_name || ''}
                  placeholder={t('hub.kol.channelPlaceholder')}
                />
              </FormField>
              <FormField label={t('hub.kol.colPlatform')}>
                <input
                  name="main_platform"
                  list="kol-platform-options"
                  defaultValue={data.main_platform || ''}
                  placeholder={t('hub.kol.platformPlaceholder')}
                />
              </FormField>
              <FormField label={t('hub.kol.colCountry')}>
                <input name="country" defaultValue={data.country || ''} placeholder={t('hub.kol.countryPlaceholder')} />
              </FormField>
              <FormField label={t('hub.kol.colTier')}>
                <input name="kol_category" defaultValue={data.kol_category || ''} placeholder={t('hub.kol.tierPlaceholder')} />
              </FormField>
              <FormField label={t('hub.kol.colTags')}>
                <input
                  name="tags"
                  list="kol-tag-options"
                  defaultValue={data.tags || (isCreate ? 'stored' : '')}
                  placeholder={t('hub.kol.tagsPlaceholder')}
                />
              </FormField>
              <FormField label={t('hub.kol.colDescription')} span={2}>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={data.description || ''}
                  placeholder={t('hub.kol.descriptionPlaceholder')}
                />
              </FormField>
              <FormField label={t('hub.kol.colLinks')} span={2}>
                <input
                  name="links"
                  type="url"
                  defaultValue={data.links || ''}
                  placeholder={t('hub.kol.linksPlaceholder')}
                />
              </FormField>
            </div>
          </section>

          {!compact ? (
            <>
              <section className="kol-edit-section" aria-labelledby="kol-edit-shipping-title">
                <h4 id="kol-edit-shipping-title" className="kol-edit-section-title">{t('hub.kol.shippingAddress')}</h4>
                <div className="kol-edit-grid">
                  <FormField label={t('hub.kol.shippingLine1')} span={2}>
                    <input name="shipping_line1" defaultValue={data.shipping_line1 || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingLine2')} span={2}>
                    <input name="shipping_line2" defaultValue={data.shipping_line2 || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingCity')}>
                    <input name="shipping_city" defaultValue={data.shipping_city || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingState')}>
                    <input name="shipping_state" defaultValue={data.shipping_state || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingPostal')}>
                    <input name="shipping_postal" defaultValue={data.shipping_postal || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingCountry')}>
                    <input name="shipping_country" defaultValue={data.shipping_country || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingPhone')}>
                    <input name="shipping_phone" defaultValue={data.shipping_phone || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingEmail')}>
                    <input name="shipping_email" type="email" defaultValue={data.shipping_email || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingNotes')} span={2}>
                    <textarea name="shipping_notes" rows={3} defaultValue={data.shipping_notes || ''} />
                  </FormField>
                </div>
                {kolShippingSummary(data) ? (
                  <p className="kol-edit-summary">{t('hub.kol.currentShipping')}: {kolShippingSummary(data)}</p>
                ) : null}
              </section>

              <section className="kol-edit-section" aria-labelledby="kol-edit-collab-title">
                <h4 id="kol-edit-collab-title" className="kol-edit-section-title">{t('hub.kol.collaborationProducts')}</h4>
                <textarea
                  name="collaboration_products"
                  rows={2}
                  defaultValue={(data.collaboration_products || []).join(', ')}
                  placeholder={t('hub.kol.collaborationProductsHint')}
                  aria-labelledby="kol-edit-collab-title"
                />
              </section>
            </>
          ) : null}
        </div>

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

        <footer className="kol-modal-foot">
          {!isCreate ? (
            <button
              type="button"
              className="appdev-btn-danger kol-modal-foot-danger"
              onClick={handleDelete}
              disabled={busy}
            >
              {t('hub.kol.deleteKol')}
            </button>
          ) : null}
          <div className="kol-modal-foot-actions">
            <button type="button" className="appdev-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="appdev-btn-primary" disabled={busy}>
              {onCreateAndAdd
                ? t('hub.campaignKol.addNewKol')
                : isCreate
                  ? t('hub.kol.saveToPool')
                  : t('hub.internal.taskPanel.save')}
            </button>
          </div>
        </footer>
      </form>
    </KolModal>
  );
}
