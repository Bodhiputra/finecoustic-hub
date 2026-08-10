'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { REFINEMENT_PLATFORMS, REFINEMENT_STATUSES, productPlatformLabel } from '@/lib/products';

export default function ProductRefinementPanel({
  item,
  onClose,
  onSave,
  onDelete,
  saving = false,
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(item);

  useEffect(() => {
    setDraft(item);
  }, [item]);

  if (!item) return null;

  const isNew = !item.id || item._draft;
  const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

  return (
    <>
      <button type="button" className="appdev-overlay" onClick={onClose} aria-label={t('hub.products.closePanel')} />
      <aside className="appdev-panel product-refinement-panel" role="dialog" aria-modal="true">
        <header className={`appdev-panel-head${isNew ? ' appdev-panel-head--draft' : ''}`}>
          <span className="appdev-issue-id">{isNew ? t('hub.products.newRefinement') : draft.title}</span>
          <button type="button" className="appdev-panel-close" onClick={onClose} aria-label={t('hub.products.closePanel')}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="appdev-panel-body">
          <label className="appdev-field">
            <span>{t('hub.internal.taskPanel.title')}</span>
            <input
              type="text"
              value={draft.title || ''}
              onChange={e => set('title', e.target.value)}
              disabled={saving}
              autoFocus={isNew}
            />
          </label>

          <label className="appdev-field">
            <span>{t('hub.internal.taskPanel.description')}</span>
            <textarea
              rows={5}
              value={draft.body || ''}
              onChange={e => set('body', e.target.value)}
              disabled={saving}
            />
          </label>

          <label className="appdev-field">
            <span>{t('hub.products.suggestedBy')}</span>
            <input
              type="text"
              value={draft.suggested_by || ''}
              onChange={e => set('suggested_by', e.target.value)}
              disabled={saving}
              placeholder={t('hub.products.suggestedByPlaceholder')}
            />
          </label>

          <div className="appdev-field-row">
            <label className="appdev-field">
              <span>{t('hub.products.platform')}</span>
              <select
                value={draft.platform || ''}
                onChange={e => set('platform', e.target.value)}
                disabled={saving}
              >
                <option value="">{t('hub.products.platformUnset')}</option>
                {REFINEMENT_PLATFORMS.map(platform => (
                  <option key={platform} value={platform}>
                    {productPlatformLabel(platform, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="appdev-field">
              <span>{t('hub.products.refinementStatus')}</span>
              <select
                value={draft.status || 'idea'}
                onChange={e => set('status', e.target.value)}
                disabled={saving}
              >
                {REFINEMENT_STATUSES.map(status => (
                  <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <footer className="appdev-panel-foot">
          {!isNew && onDelete ? (
            <button type="button" className="appdev-btn-danger" onClick={() => onDelete(draft.id)} disabled={saving}>
              {t('hub.products.deleteItem')}
            </button>
          ) : (
            <span />
          )}
          <div className="appdev-panel-foot-actions">
            <button
              type="button"
              className="appdev-btn-primary"
              onClick={() => onSave?.(draft)}
              disabled={saving || !draft.title?.trim()}
            >
              {saving ? t('hub.products.savingItem') : t('hub.products.saveItem')}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
