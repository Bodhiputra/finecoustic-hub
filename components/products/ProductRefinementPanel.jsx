'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { REFINEMENT_STATUSES } from '@/lib/products';

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

  return (
    <>
      <button type="button" className="appdev-overlay" onClick={onClose} aria-label={t('hub.products.closePanel')} />
      <aside className="appdev-panel product-refinement-panel" role="dialog" aria-modal="true">
        <header className={`appdev-panel-head${isNew ? ' appdev-panel-head--draft' : ''}`}>
          <span className="appdev-issue-id">{isNew ? 'New refinement' : draft.title}</span>
          <button type="button" className="appdev-panel-close" onClick={onClose} aria-label={t('hub.products.closePanel')}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="appdev-panel-body">
          <label className="appdev-field">
            <span>Title</span>
            <input
              type="text"
              value={draft.title || ''}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              disabled={saving}
              autoFocus={isNew}
            />
          </label>

          <label className="appdev-field">
            <span>Description</span>
            <textarea
              rows={5}
              value={draft.body || ''}
              onChange={e => setDraft({ ...draft, body: e.target.value })}
              disabled={saving}
            />
          </label>

          <label className="appdev-field">
            <span>Status</span>
            <select
              value={draft.status || 'idea'}
              onChange={e => setDraft({ ...draft, status: e.target.value })}
              disabled={saving}
            >
              {REFINEMENT_STATUSES.map(status => (
                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        <footer className="appdev-panel-foot">
          {!isNew && onDelete ? (
            <button type="button" className="appdev-btn-danger" onClick={() => onDelete(draft.id)} disabled={saving}>
              Delete
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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
