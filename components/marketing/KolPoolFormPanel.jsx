'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import KolModal from '@/components/KolModal';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import { API_V1, unwrapData } from '@/lib/api/routes';
import KolChipPicker from '@/components/marketing/KolChipPicker';
import {
  KOL_PLATFORM_SUGGESTIONS,
  KOL_TAG_SUGGESTIONS,
  KOL_TAG_LABEL_KEYS,
  KOL_TIER_OPTIONS,
  isHubNativeKol,
  kolLinkAriaLabel,
  kolLinkIconName,
  kolRecordSourceLabel,
  kolShippingSummary,
  normalizeKolTagChoice,
  normalizeKolTierChoice,
  partitionCollabProductsByCatalog,
} from '@/lib/kol-pool';

function formPayload(fd, { links, collaboration_products, tags, kol_category }) {
  return {
    channel_name: fd.get('channel_name'),
    description: fd.get('description'),
    links,
    main_platform: fd.get('main_platform'),
    country: fd.get('country'),
    kol_category,
    tags,
    shipping_name: fd.get('shipping_name'),
    shipping_line1: fd.get('shipping_line1'),
    shipping_line2: fd.get('shipping_line2'),
    shipping_city: fd.get('shipping_city'),
    shipping_state: fd.get('shipping_state'),
    shipping_postal: fd.get('shipping_postal'),
    shipping_country: fd.get('shipping_country'),
    shipping_country_code: fd.get('shipping_country_code'),
    shipping_phone: fd.get('shipping_phone'),
    shipping_email: fd.get('shipping_email'),
    shipping_tax_id: fd.get('shipping_tax_id'),
    collaboration_products,
  };
}

function FormField({ label, hint, required = false, span = 1, children }) {
  return (
    <label className={span === 2 ? 'kol-edit-span-2' : undefined}>
      <span className="kol-edit-label">
        {label}
        {required ? ' *' : null}
      </span>
      {hint ? <span className="kol-shipping-field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

function CollabProductChips({ products, selectedSkus, legacyEntries, onToggle, disabled, ariaLabel }) {
  if (!products.length && !legacyEntries.length) {
    return <p className="kol-collab-products-empty">—</p>;
  }

  return (
    <div className="kol-collab-product-chips" role="group" aria-label={ariaLabel}>
      {products.map(product => {
        const active = selectedSkus.has(product.sku);
        return (
          <button
            key={product.sku}
            type="button"
            className={`kol-collab-product-chip${active ? ' is-active' : ''}`}
            aria-pressed={active}
            title={product.name}
            onClick={() => onToggle(product.sku)}
            disabled={disabled}
          >
            {product.sku}
          </button>
        );
      })}
      {legacyEntries.map(entry => (
        <span key={entry} className="kol-collab-product-chip is-legacy" title={entry}>
          {entry}
        </span>
      ))}
    </div>
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
  const { requestConfirm, confirmDialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState('');
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [selectedCollabSkus, setSelectedCollabSkus] = useState(() => new Set());
  const [legacyCollabEntries, setLegacyCollabEntries] = useState([]);
  const [tags, setTags] = useState('stored');
  const [kolCategory, setKolCategory] = useState('');
  const isCreate = mode === 'create';
  const data = record || {};

  const activeCatalogProducts = useMemo(
    () => catalogProducts.filter(product => product.status !== 'discontinued'),
    [catalogProducts]
  );

  const socialIconName = useMemo(
    () => kolLinkIconName({ links, main_platform: data.main_platform }),
    [links, data.main_platform]
  );

  const socialLink = links.trim();

  useEffect(() => {
    fetch(API_V1.products, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const payload = unwrapData(body);
        setCatalogProducts(Array.isArray(payload?.products) ? payload.products : []);
      })
      .catch(() => setCatalogProducts([]));
  }, []);

  const catalogProductKey = activeCatalogProducts.map(product => product.sku).join(',');

  useEffect(() => {
    setLinks(data.links || '');
    setTags(normalizeKolTagChoice(data.tags, { isCreate }) || 'stored');
    setKolCategory(normalizeKolTierChoice(data.kol_category));
    const { skus, legacy } = partitionCollabProductsByCatalog(
      data.collaboration_products,
      activeCatalogProducts
    );
    setSelectedCollabSkus(new Set(skus));
    setLegacyCollabEntries(legacy);
  }, [data.notion_page_id, data.links, data.tags, data.kol_category, data.collaboration_products, catalogProductKey, isCreate]);

  const tagOptions = useMemo(
    () => KOL_TAG_SUGGESTIONS.map(id => ({
      id,
      label: t(KOL_TAG_LABEL_KEYS[id] || id),
      tone: id === 'unqualified' ? 'danger' : id === 'qualified' ? 'ok' : undefined,
    })),
    [t]
  );

  const tierOptions = useMemo(
    () => [
      { id: '', label: t('hub.kol.tierUnset') },
      ...KOL_TIER_OPTIONS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
    ],
    [t]
  );

  if (!isCreate && !record) return null;

  function toggleCollabSku(sku) {
    setSelectedCollabSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const collaboration_products = [
        ...legacyCollabEntries,
        ...Array.from(selectedCollabSkus),
      ];
      const payload = formPayload(new FormData(e.currentTarget), {
        links: socialLink,
        collaboration_products,
        tags,
        kol_category: kolCategory,
      });

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
    const confirmed = await requestConfirm({
      title: t('hub.kol.deleteKol'),
      message,
      confirmLabel: t('hub.kol.deleteKol'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;

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
              <div className="kol-edit-span-2 kol-pool-choice-field">
                <span className="kol-edit-label">{t('hub.kol.colTier')}</span>
                <p className="kol-pool-choice-hint">{t('hub.kol.tierPickerHint')}</p>
                <KolChipPicker
                  options={tierOptions}
                  value={kolCategory}
                  onChange={setKolCategory}
                  disabled={busy}
                  ariaLabel={t('hub.kol.colTier')}
                />
              </div>
              <div className="kol-edit-span-2 kol-pool-choice-field">
                <span className="kol-edit-label">{t('hub.kol.colTags')}</span>
                <p className="kol-pool-choice-hint">{t('hub.kol.tagPickerHint')}</p>
                <KolChipPicker
                  options={tagOptions}
                  value={tags}
                  onChange={setTags}
                  disabled={busy}
                  ariaLabel={t('hub.kol.colTags')}
                />
              </div>
              <FormField label={t('hub.kol.colDescription')} span={2}>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={data.description || ''}
                  placeholder={t('hub.kol.descriptionPlaceholder')}
                />
              </FormField>
              <FormField label={t('hub.kol.colLinks')} span={2}>
                <div className="kol-pool-social-edit">
                  {socialLink ? (
                    <a
                      href={socialLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`kol-pool-link-icon kol-pool-link-icon--lg is-${socialIconName}`}
                      aria-label={kolLinkAriaLabel({ links: socialLink, main_platform: data.main_platform }, t)}
                      title={kolLinkAriaLabel({ links: socialLink, main_platform: data.main_platform }, t)}
                    >
                      <Icon name={socialIconName} size={20} />
                    </a>
                  ) : (
                    <span className="kol-pool-link-icon kol-pool-link-icon--lg is-empty" aria-hidden="true">
                      <Icon name="externalLink" size={20} />
                    </span>
                  )}
                  <label className="kol-pool-social-url">
                    <span className="sr-only">{t('hub.kol.linksPlaceholder')}</span>
                    <input
                      type="url"
                      value={links}
                      onChange={e => setLinks(e.target.value)}
                      placeholder={t('hub.kol.linksPlaceholder')}
                      disabled={busy}
                    />
                  </label>
                </div>
              </FormField>
            </div>
          </section>

          {!compact ? (
            <>
              <section className="kol-edit-section" aria-labelledby="kol-edit-shipping-title">
                <h4 id="kol-edit-shipping-title" className="kol-edit-section-title">{t('hub.kol.shippingAddress')}</h4>
                <div className="kol-edit-grid">
                  <FormField label={t('hub.kol.shippingName')} required span={2}>
                    <input
                      name="shipping_name"
                      defaultValue={data.shipping_name || data.channel_name || ''}
                      placeholder={t('hub.kol.shippingNamePlaceholder')}
                    />
                  </FormField>
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
                  <FormField label={t('hub.kol.shippingCountryCode')} required>
                    <input
                      name="shipping_country_code"
                      defaultValue={data.shipping_country_code || ''}
                      placeholder={t('hub.kol.shippingCountryCodePlaceholder')}
                      maxLength={2}
                      className="kol-shipping-country-code-input"
                      autoComplete="country"
                    />
                  </FormField>
                  <FormField label={t('hub.kol.shippingPhone')}>
                    <input name="shipping_phone" defaultValue={data.shipping_phone || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingEmail')}>
                    <input name="shipping_email" type="email" defaultValue={data.shipping_email || ''} />
                  </FormField>
                  <FormField label={t('hub.kol.shippingTaxId')} hint={t('hub.kol.shippingTaxIdHint')} span={2}>
                    <input
                      name="shipping_tax_id"
                      defaultValue={data.shipping_tax_id || ''}
                      placeholder={t('hub.kol.shippingTaxIdPlaceholder')}
                    />
                  </FormField>
                </div>
                {kolShippingSummary(data) ? (
                  <p className="kol-edit-summary">{t('hub.kol.currentShipping')}: {kolShippingSummary(data)}</p>
                ) : null}
              </section>

              <section className="kol-edit-section" aria-labelledby="kol-edit-collab-title">
                <h4 id="kol-edit-collab-title" className="kol-edit-section-title">{t('hub.kol.collaborationProducts')}</h4>
                <CollabProductChips
                  products={activeCatalogProducts}
                  selectedSkus={selectedCollabSkus}
                  legacyEntries={legacyCollabEntries}
                  onToggle={toggleCollabSku}
                  disabled={busy}
                  ariaLabel={t('hub.kol.collaborationProducts')}
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

      {confirmDialog}
    </KolModal>
  );
}
