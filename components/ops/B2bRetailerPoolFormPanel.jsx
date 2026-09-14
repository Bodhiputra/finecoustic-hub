'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import KolModal from '@/components/KolModal';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  B2B_RETAILER_TAG_IDS,
  B2B_TAG_LABEL_KEYS,
  kolLinkIconName,
  normalizeB2bRetailerTag,
} from '@/lib/b2b-retailer-pool';

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

export default function B2bRetailerPoolFormPanel({
  mode = 'edit',
  record = null,
  onClose,
  onSaved,
  onDeleted,
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const { requestConfirm, confirmDialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState('');
  const [tag, setTag] = useState('potential');
  const isCreate = mode === 'create';
  const data = record || {};

  const socialIconName = useMemo(() => kolLinkIconName({ links }), [links]);

  useEffect(() => {
    setLinks(data.links || '');
    setTag(normalizeB2bRetailerTag(data.tag) || 'potential');
  }, [data.id, data.links, data.tag, isCreate]);

  const tagOptions = useMemo(
    () =>
      B2B_RETAILER_TAG_IDS.map(id => ({
        id,
        label: t(B2B_TAG_LABEL_KEYS[id]),
      })),
    [t]
  );

  if (!isCreate && !record) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        name: fd.get('name'),
        website: fd.get('website'),
        country: fd.get('country'),
        partner_code: fd.get('partner_code'),
        links: links.trim(),
        tag,
      };

      const res = await fetch(
        isCreate ? API_V1.opsB2bRetailers : API_V1.opsB2bRetailerRecord(data.id),
        {
          method: isCreate ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === 'name_required') {
          toast.error(t('hub.b2bRetailers.nameRequired'));
          return;
        }
        if (body?.error === 'tag_required') {
          toast.error(t('hub.b2bRetailers.tagRequired'));
          return;
        }
        if (body?.error === 'partner_code_duplicate') {
          toast.error(t('hub.b2bRetailers.partnerCodeDuplicate'));
          return;
        }
        toast.error(t('common.somethingWrong'));
        return;
      }

      const result = unwrapData(await res.json());
      toast.success(isCreate ? t('hub.b2bRetailers.created') : t('hub.b2bRetailers.saved'));
      onSaved?.(result?.record || null);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (isCreate || !data?.id) return;
    const confirmed = await requestConfirm({
      title: t('hub.b2bRetailers.deleteRetailer'),
      message: t('hub.b2bRetailers.deleteConfirm'),
      confirmLabel: t('hub.b2bRetailers.deleteRetailer'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await fetch(API_V1.opsB2bRetailerRecord(data.id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      toast.success(t('hub.b2bRetailers.deleted'));
      onDeleted?.(data.id);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <KolModal open wide onClose={onClose} labelledBy="b2b-retailer-form-title">
      <header className="kol-modal-head">
        <div className="kol-modal-head-copy">
          <h3 id="b2b-retailer-form-title">
            {isCreate ? t('hub.b2bRetailers.addRetailer') : data.name || t('hub.b2bRetailers.editRetailer')}
          </h3>
        </div>
        <button type="button" className="appdev-btn-ghost kol-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
          <Icon name="x" size={16} />
        </button>
      </header>
      <form className="kol-edit-form kol-pool-edit-form" onSubmit={handleSubmit}>
        <div className="kol-edit-grid">
          <FormField label={t('hub.b2bRetailers.colName')} required span={2}>
            <input name="name" required defaultValue={data.name || ''} placeholder={t('hub.b2bRetailers.namePlaceholder')} />
          </FormField>
          <FormField label={t('hub.b2bRetailers.colTag')} required span={2}>
            <div className="kol-chip-picker" role="group" aria-label={t('hub.b2bRetailers.tagPickerHint')}>
              {tagOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`kol-chip-picker-btn${tag === option.id ? ' is-active' : ''}`}
                  aria-pressed={tag === option.id}
                  onClick={() => setTag(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label={t('hub.b2bRetailers.colPartnerCode')} hint={t('hub.b2bRetailers.partnerCodeHint')}>
            <input name="partner_code" defaultValue={data.partner_code || ''} placeholder={t('hub.b2bRetailers.partnerCodePlaceholder')} />
          </FormField>
          <FormField label={t('hub.b2bRetailers.colCountry')}>
            <input name="country" defaultValue={data.country || ''} placeholder={t('hub.b2bRetailers.countryPlaceholder')} />
          </FormField>
          <FormField label={t('hub.b2bRetailers.colWebsite')} span={2}>
            <input name="website" type="url" defaultValue={data.website || ''} placeholder="https://…" />
          </FormField>
          <FormField label={t('hub.b2bRetailers.colLinks')} span={2}>
            <div className="kol-edit-links-row">
              {links.trim() ? (
                <span className={`kol-pool-link-icon is-${socialIconName}`} aria-hidden>
                  <Icon name={socialIconName} size={18} />
                </span>
              ) : null}
              <input
                value={links}
                onChange={e => setLinks(e.target.value)}
                placeholder={t('hub.b2bRetailers.linksPlaceholder')}
              />
            </div>
          </FormField>
        </div>
        <div className="kol-edit-actions">
          {!isCreate ? (
            <button type="button" className="kol-edit-delete" onClick={handleDelete} disabled={busy}>
              {t('hub.b2bRetailers.deleteRetailer')}
            </button>
          ) : null}
          <div className="kol-edit-actions-right">
            <button type="button" className="hub-btn hub-btn-ghost" onClick={onClose} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="hub-btn hub-btn-primary" disabled={busy}>
              {busy ? t('common.saving') : isCreate ? t('hub.b2bRetailers.addRetailer') : t('common.save')}
            </button>
          </div>
        </div>
      </form>
      {confirmDialog}
    </KolModal>
  );
}
