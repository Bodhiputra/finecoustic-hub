'use client';

import { useEffect, useState } from 'react';
import DatePicker from '@/components/appdev/DatePicker';
import MediaUrlFields from '@/components/appdev/MediaUrlFields';
import IssueChat from '@/components/appdev/IssueChat';
import WorkersField from '@/components/appdev/WorkersField';
import Icon from '@/components/Icon';
import IssueTypeField, { IssueTypeLabel } from '@/components/appdev/IssueTypeField';
import { PRIORITIES, formatIssueDate, formatIssueId, personKey } from '@/lib/appdev';
import { getIssueWorkers, hasWorkers } from '@/lib/appdev-workers';
import { ASSIGNEE_ONLY_STATUSES, getIssueCapabilities, getStatusOptionsForIssue } from '@/lib/appdev-task-permissions';
import { isDraftIssue } from '@/lib/appdev-draft';
import { useLocale } from '@/components/LocaleProvider';

function ReadonlyValue({ children, className = '' }) {
  return <div className={`appdev-readonly-value ${className}`.trim()}>{children || '—'}</div>;
}

export default function IssuePanel({
  issue,
  people = [],
  assignablePeople = [],
  taskTypes = [],
  registerTaskType,
  currentUser = '',
  isAdmin = false,
  onClose,
  onSave,
  onPatch,
  onDelete,
  onPostComment,
  t,
  saving,
  postingComment,
}) {
  const { locale } = useLocale();
  const [draft, setDraft] = useState(issue);
  const [panelNotice, setPanelNotice] = useState('');

  useEffect(() => {
    setDraft(issue);
    setPanelNotice('');
  }, [issue]);

  if (!issue) return null;

  const isDraft = isDraftIssue(issue);
  const actor = { isAdmin, displayName: currentUser };
  const workers = getIssueWorkers(draft);
  const effectiveIssue = { ...issue, workers, status: draft.status };
  const caps = getIssueCapabilities(actor, effectiveIssue);
  const statusOptions = getStatusOptionsForIssue(effectiveIssue, actor);

  const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

  const setWorkers = nextWorkers => {
    setPanelNotice('');
    const prevWorkers = getIssueWorkers(draft);
    setDraft(prev => {
      const hadWorkers = hasWorkers(prev);
      const next = {
        ...prev,
        workers: nextWorkers,
        worker: nextWorkers[0] || '',
      };
      if (nextWorkers.length && !hadWorkers) {
        next.assigned_at = new Date().toISOString();
      } else if (!nextWorkers.length) {
        next.assigned_at = null;
      }
      return next;
    });

    const joinedSelf =
      !isDraft &&
      onPatch &&
      currentUser &&
      !caps.canManageWorkers &&
      !prevWorkers.some(w => personKey(w) === personKey(currentUser)) &&
      nextWorkers.some(w => personKey(w) === personKey(currentUser));

    if (joinedSelf) {
      onPatch(issue.id, { workers: nextWorkers });
    }
  };

  const setStatus = status => {
    if (!caps.canChangeStatus) {
      setPanelNotice(t('appdev.board.error.assigneeRequired'));
      return;
    }
    if (!caps.isOwner && ASSIGNEE_ONLY_STATUSES.includes(status)) {
      setPanelNotice(t('appdev.board.error.statusAssignerOnly'));
      return;
    }
    if (status === 'in_progress' && !hasWorkers(workers)) {
      setPanelNotice(t('appdev.board.error.workerRequired'));
      return;
    }

    setPanelNotice('');
    setDraft(prev => {
      const next = { ...prev, status };
      if (status === 'done' && !prev.completed_at) {
        next.completed_at = new Date().toISOString();
      } else if (status !== 'done') {
        next.completed_at = null;
      }
      return next;
    });
  };

  const handleSave = () => {
    if (draft.status === 'in_progress' && !hasWorkers(getIssueWorkers(draft))) {
      setPanelNotice(t('appdev.board.error.workerRequired'));
      return;
    }
    setPanelNotice('');
    onSave(draft);
  };

  const contributorNotice = caps.canClaimWork
    ? t('appdev.board.viewerNotice').replace('{assigner}', issue.assignee || '—')
    : t('appdev.board.contributorNotice').replace('{assigner}', issue.assignee || '—');

  return (
    <>
      <button type="button" className="appdev-overlay" onClick={onClose} aria-label={t('appdev.board.close')} />
      <aside className="appdev-panel" role="dialog" aria-modal="true" aria-labelledby="issue-panel-title">
        <header className={`appdev-panel-head${isDraft ? ' appdev-panel-head--draft' : ''}`}>
          {isDraft ? (
            issue.preview_number ? (
              <span className="appdev-issue-id appdev-issue-id--preview" title={t('appdev.board.idPreviewHint')}>
                {formatIssueId(issue.preview_number)}
              </span>
            ) : null
          ) : (
            <span className="appdev-issue-id">{issue.id}</span>
          )}
          <button type="button" className="appdev-panel-close" onClick={onClose} aria-label={t('appdev.board.close')}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="appdev-panel-body">
          {!caps.isOwner && (
            <p className="appdev-contributor-notice" role="note">
              {contributorNotice}
            </p>
          )}

          {panelNotice && (
            <p className="appdev-panel-notice" role="alert">
              {panelNotice}
            </p>
          )}

          <div className="appdev-field">
            <span>{t('appdev.board.title')}</span>
            {caps.canEditMetadata ? (
              <input
                id="issue-panel-title"
                value={draft.title}
                onChange={e => set('title', e.target.value)}
                disabled={saving}
              />
            ) : (
              <ReadonlyValue id="issue-panel-title">{draft.title}</ReadonlyValue>
            )}
          </div>

          <div className="appdev-field">
            <span>{t('appdev.board.description')}</span>
            {caps.canEditMetadata ? (
              <textarea
                rows={5}
                value={draft.description}
                onChange={e => set('description', e.target.value)}
                placeholder={t('appdev.board.descriptionPlaceholder')}
                disabled={saving}
              />
            ) : (
              <ReadonlyValue className="appdev-readonly-multiline">
                {draft.description || t('appdev.board.noDescription')}
              </ReadonlyValue>
            )}
          </div>

          <MediaUrlFields
            imageUrls={draft.image_urls || []}
            videoUrls={draft.video_urls || []}
            onChangeImages={urls => set('image_urls', urls)}
            onChangeVideos={urls => set('video_urls', urls)}
            t={t}
            disabled={saving}
            canManageMedia={caps.canManageMedia}
          />

          <div className="appdev-field-row">
            <div className="appdev-field">
              <span>{t('appdev.board.type')}</span>
              {caps.canEditMetadata ? (
                <IssueTypeField
                  value={draft.type}
                  onChange={next => set('type', next)}
                  taskTypes={taskTypes}
                  onRegisterType={registerTaskType}
                  disabled={saving}
                />
              ) : (
                <ReadonlyValue><IssueTypeLabel type={draft.type} /></ReadonlyValue>
              )}
            </div>

            <label className="appdev-field">
              <span>{t('appdev.board.status')}</span>
              {caps.canChangeStatus ? (
                <select
                  value={draft.status}
                  onChange={e => setStatus(e.target.value)}
                  disabled={saving}
                >
                  {statusOptions.map(s => (
                    <option key={s} value={s}>{t(`appdev.status.${s}`)}</option>
                  ))}
                </select>
              ) : (
                <ReadonlyValue>{t(`appdev.status.${draft.status}`)}</ReadonlyValue>
              )}
            </label>
          </div>

          <div className="appdev-field-row">
            <div className="appdev-field">
              <span>{t('appdev.board.priority')}</span>
              {caps.canEditMetadata ? (
                <select
                  value={draft.priority}
                  onChange={e => set('priority', e.target.value)}
                  disabled={saving}
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>{t(`appdev.priority.${p}`)}</option>
                  ))}
                </select>
              ) : (
                <ReadonlyValue>{t(`appdev.priority.${draft.priority || 'none'}`)}</ReadonlyValue>
              )}
            </div>

            <div className="appdev-field">
              <span>{t('appdev.board.assigner')}</span>
              <ReadonlyValue>{draft.assignee || '—'}</ReadonlyValue>
            </div>
          </div>

          <WorkersField
            workers={workers}
            onChange={setWorkers}
            people={assignablePeople}
            currentUser={currentUser}
            mode={caps.canManageWorkers ? 'owner' : 'contributor'}
            label={t('appdev.board.assignee')}
            hint={caps.canManageWorkers ? t('appdev.board.assigneeHintOwner') : t('appdev.board.assigneeHintContributor')}
            placeholder={t('appdev.board.assigneePlaceholder')}
            disabled={saving}
            t={t}
          />

          <div className="appdev-field-row">
            <div className="appdev-field">
              <span>{t('appdev.board.assignedAt')}</span>
              {caps.canEditDates ? (
                <DatePicker
                  id="issue-assigned-at"
                  value={draft.assigned_at}
                  onChange={v => set('assigned_at', v)}
                  disabled={saving}
                  locale={locale}
                  placeholder={t('appdev.board.pickDate')}
                />
              ) : (
                <ReadonlyValue>{formatIssueDate(draft.assigned_at, locale)}</ReadonlyValue>
              )}
            </div>
            <div className="appdev-field">
              <span>{t('appdev.board.completedAt')}</span>
              {caps.canEditDates ? (
                <DatePicker
                  id="issue-completed-at"
                  value={draft.completed_at}
                  onChange={v => set('completed_at', v)}
                  disabled={saving || draft.status !== 'done'}
                  locale={locale}
                  placeholder={t('appdev.board.pickDate')}
                />
              ) : (
                <ReadonlyValue>{formatIssueDate(draft.completed_at, locale)}</ReadonlyValue>
              )}
            </div>
          </div>

          {isDraft ? (
            <p className="appdev-panel-notice" role="note">
              {t('appdev.chat.saveFirst')}
            </p>
          ) : (
            <IssueChat
              comments={issue.comments || []}
              people={people}
              displayName={currentUser}
              onPost={onPostComment}
              posting={postingComment}
              canPost={caps.canDiscuss}
              t={t}
              locale={locale}
            />
          )}
        </div>

        <footer className="appdev-panel-foot">
          {caps.canDelete ? (
            <button
              type="button"
              className="appdev-btn-danger"
              onClick={() => onDelete(issue.id)}
              disabled={saving}
            >
              {t('appdev.board.delete')}
            </button>
          ) : (
            <span />
          )}
          <div className="appdev-panel-foot-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              {t('appdev.board.cancel')}
            </button>
            <button
              type="button"
              className="appdev-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('appdev.board.saving') : t('appdev.board.save')}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
