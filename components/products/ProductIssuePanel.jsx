'use client';

import { useEffect, useState } from 'react';
import IssueChat from '@/components/appdev/IssueChat';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { ISSUE_SOURCES, ISSUE_STATUSES, issueSourceLabel, issueStatusLabel } from '@/lib/products';
import { uploadInternalMediaFile } from '@/lib/hub-upload-client';

export default function ProductIssuePanel({
  item,
  onClose,
  onSave,
  onDelete,
  displayName = '',
  saving = false,
}) {
  const { t, locale } = useLocale();
  const [draft, setDraft] = useState(item);
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    setDraft(item);
  }, [item]);

  if (!item) return null;

  const isNew = !item.id || item._draft;
  const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

  async function handleSave() {
    await onSave?.(draft);
  }

  async function postComment(payload) {
    if (!draft.id) return;
    setPostingComment(true);
    try {
      const res = await fetch(API_V1.productItemComments(draft.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('comment_failed');
      const body = await res.json();
      const data = unwrapData(body);
      if (data?.item) setDraft(data.item);
    } finally {
      setPostingComment(false);
    }
  }

  const panelTitle = isNew ? t('hub.products.newIssue') : draft.title;

  return (
    <>
      <button type="button" className="appdev-overlay" onClick={onClose} aria-label={t('hub.products.closePanel')} />
      <aside className="appdev-panel product-issue-panel" role="dialog" aria-modal="true">
        <header className={`appdev-panel-head${isNew ? ' appdev-panel-head--draft' : ''}`}>
          <span className="appdev-issue-id">{panelTitle}</span>
          <button type="button" className="appdev-panel-close" onClick={onClose} aria-label={t('hub.products.closePanel')}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="appdev-panel-body">
          <div className="appdev-field">
            <span>{t('hub.internal.taskPanel.title')}</span>
            <input
              value={draft.title || ''}
              onChange={e => set('title', e.target.value)}
              disabled={saving}
              placeholder="Question or problem summary"
              autoFocus={isNew}
            />
          </div>

          <div className="appdev-field">
            <span>{t('hub.internal.taskPanel.description')}</span>
            <textarea
              rows={5}
              value={draft.body || ''}
              onChange={e => set('body', e.target.value)}
              disabled={saving}
              placeholder="Details from KOL, customer, or internal report…"
            />
          </div>

          <div className="appdev-field-row">
            <label className="appdev-field">
              <span>Source</span>
              <select
                value={draft.source || 'other'}
                onChange={e => set('source', e.target.value)}
                disabled={saving}
              >
                {ISSUE_SOURCES.map(source => (
                  <option key={source} value={source}>{issueSourceLabel(source)}</option>
                ))}
              </select>
            </label>
            <label className="appdev-field">
              <span>Status</span>
              <select
                value={draft.status || 'open'}
                onChange={e => set('status', e.target.value)}
                disabled={saving}
              >
                {ISSUE_STATUSES.map(status => (
                  <option key={status} value={status}>{issueStatusLabel(status, t)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="appdev-field">
            <span>Assignee (PM)</span>
            <input
              type="text"
              value={draft.assignee || ''}
              onChange={e => set('assignee', e.target.value)}
              disabled={saving}
              placeholder="Who is answering"
            />
          </label>

          {!isNew ? (
            <IssueChat
              comments={draft.comments || []}
              displayName={displayName}
              onPost={postComment}
              posting={postingComment}
              canPost
              t={t}
              locale={locale}
              uploadMediaFile={uploadInternalMediaFile}
            />
          ) : (
            <p className="appdev-panel-notice" role="note">{t('appdev.chat.saveFirst')}</p>
          )}
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
              onClick={handleSave}
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
