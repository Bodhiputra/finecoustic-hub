'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DatePicker from '@/components/appdev/DatePicker';
import MediaUrlFields from '@/components/appdev/MediaUrlFields';
import FileUrlFields from '@/components/appdev/FileUrlFields';
import IssueChat from '@/components/appdev/IssueChat';
import WorkersField from '@/components/appdev/WorkersField';
import Icon from '@/components/Icon';
import IssueTypeField, { IssueTypeLabel } from '@/components/appdev/IssueTypeField';
import { formatIssueDate, formatIssueId } from '@/lib/appdev';
import { getIssueWorkers, hasWorkers } from '@/lib/appdev-workers';
import { ASSIGNEE_ONLY_STATUSES, getIssueCapabilities, getStatusOptionsForIssue } from '@/lib/appdev-task-permissions';
import { isDraftIssue } from '@/lib/appdev-draft';
import { useLocale } from '@/components/LocaleProvider';

const TEXT_PATCH_DELAY_MS = 450;

function ReadonlyValue({ children, className = '' }) {
  return <div className={`appdev-readonly-value ${className}`.trim()}>{children || '—'}</div>;
}

function StatusPick({ legend, value, options, onChange, labelFor, disabled = false }) {
  return (
    <fieldset className="appdev-status-pick">
      <legend className="appdev-status-pick-label">{legend}</legend>
      <div className="appdev-status-pick-options" role="radiogroup" aria-label={legend}>
        {options.map(status => (
          <label
            key={status}
            className={`appdev-status-pick-option is-${status}${value === status ? ' is-active' : ''}`}
          >
            <input
              type="radio"
              name="issue-status"
              value={status}
              checked={value === status}
              onChange={() => onChange(status)}
              disabled={disabled}
            />
            <span>{labelFor(status)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
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
  onEditActivity,
  t,
  saving,
  postingComment,
}) {
  const { locale } = useLocale();
  const [draft, setDraft] = useState(issue);
  const [panelNotice, setPanelNotice] = useState('');
  const pendingPatchRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const issueIdRef = useRef(issue?.id);

  useEffect(() => {
    if (!issue) return;

    const switched = issueIdRef.current !== issue.id;
    issueIdRef.current = issue.id;

    const hasPendingText =
      Boolean(pendingPatchRef.current) || Boolean(debounceTimerRef.current);

    if (switched) {
      setDraft(issue);
      setPanelNotice('');
      pendingPatchRef.current = null;
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      return;
    }

    if (hasPendingText) {
      setDraft(prev => ({
        ...prev,
        comments: issue.comments,
        updated_at: issue.updated_at,
      }));
      return;
    }

    setDraft(issue);
  }, [issue]);

  useEffect(
    () => () => {
      clearTimeout(debounceTimerRef.current);
    },
    []
  );

  const commitPatch = useCallback(
    async patch => {
      if (!onPatch || isDraftIssue(issue)) return { ok: true };
      setPanelNotice('');
      const result = await onPatch(issue.id, patch, { silent: true });
      if (!result?.ok) {
        setPanelNotice(result.message || t('appdev.board.saveError'));
        setDraft(issue);
      }
      return result;
    },
    [issue, onPatch, t]
  );

  const flushPendingPatch = useCallback(async () => {
    clearTimeout(debounceTimerRef.current);
    if (!pendingPatchRef.current) return;
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = null;
    await commitPatch(patch);
  }, [commitPatch]);

  const scheduleTextPatch = useCallback(
    patch => {
      onEditActivity?.();
      pendingPatchRef.current = { ...(pendingPatchRef.current || {}), ...patch };
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        const queued = pendingPatchRef.current;
        pendingPatchRef.current = null;
        if (queued) await commitPatch(queued);
      }, TEXT_PATCH_DELAY_MS);
    },
    [commitPatch, onEditActivity]
  );

  const applyPatch = useCallback(
    async (patch, { debounce = false } = {}) => {
      setDraft(prev => ({ ...prev, ...patch }));
      if (isDraftIssue(issue)) return;

      onEditActivity?.();

      if (debounce) {
        scheduleTextPatch(patch);
        return;
      }

      await flushPendingPatch();
      await commitPatch(patch);
    },
    [issue, commitPatch, flushPendingPatch, scheduleTextPatch, onEditActivity]
  );

  if (!issue) return null;

  const isDraft = isDraftIssue(issue);
  const actor = { isAdmin, displayName: currentUser };
  const workers = getIssueWorkers(draft);
  const effectiveIssue = { ...issue, workers, status: draft.status };
  const caps = getIssueCapabilities(actor, effectiveIssue);
  const statusOptions = getStatusOptionsForIssue(effectiveIssue, actor);

  const setWorkers = nextWorkers => {
    setPanelNotice('');
    const prevWorkers = getIssueWorkers(draft);
    if (
      prevWorkers.length === nextWorkers.length &&
      prevWorkers.every((w, i) => w === nextWorkers[i])
    ) {
      return;
    }

    const patch = {
      workers: nextWorkers,
      worker: nextWorkers[0] || '',
    };

    // Only assigner/admin may set assigned_at — contributors joining must not send it
    // (server auto-stamps when the first assignee is added).
    if (caps.canManageWorkers) {
      const hadWorkers = hasWorkers(draft);
      let assigned_at = draft.assigned_at;
      if (nextWorkers.length && !hadWorkers) {
        assigned_at = new Date().toISOString();
      } else if (!nextWorkers.length) {
        assigned_at = null;
      }
      patch.assigned_at = assigned_at;
    }

    applyPatch(patch);
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
    let completed_at = draft.completed_at;
    if (status === 'done' && !completed_at) {
      completed_at = new Date().toISOString();
    } else if (status !== 'done') {
      completed_at = null;
    }

    applyPatch({ status, completed_at });
  };

  const handleSave = () => {
    if (draft.status === 'in_progress' && !hasWorkers(getIssueWorkers(draft))) {
      setPanelNotice(t('appdev.board.error.workerRequired'));
      return;
    }
    setPanelNotice('');
    onSave(draft);
  };

  const handleClose = async () => {
    if (!isDraft) await flushPendingPatch();
    onClose();
  };

  const contributorNotice = caps.canClaimWork
    ? t('appdev.board.viewerNotice').replace('{assigner}', issue.assignee || '—')
    : t('appdev.board.contributorNotice').replace('{assigner}', issue.assignee || '—');

  return (
    <>
      <button type="button" className="appdev-overlay" onClick={handleClose} aria-label={t('appdev.board.close')} />
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
          <button type="button" className="appdev-panel-close" onClick={handleClose} aria-label={t('appdev.board.close')}>
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
                onChange={e => applyPatch({ title: e.target.value }, { debounce: !isDraft })}
                onBlur={() => {
                  if (!isDraft) flushPendingPatch();
                }}
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
                onChange={e => applyPatch({ description: e.target.value }, { debounce: !isDraft })}
                onBlur={() => {
                  if (!isDraft) flushPendingPatch();
                }}
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
            onChangeImages={urls => applyPatch({ image_urls: urls })}
            onChangeVideos={urls => applyPatch({ video_urls: urls })}
            t={t}
            disabled={saving}
            canManageMedia={caps.canManageMedia}
          />

          <FileUrlFields
            fileUrls={draft.file_urls || []}
            onChangeFiles={files => applyPatch({ file_urls: files })}
            t={t}
            disabled={saving}
            canManageFiles={caps.canManageMedia}
          />

          <div className="appdev-field">
            <span>{t('appdev.board.type')}</span>
            {caps.canEditMetadata ? (
              <IssueTypeField
                value={draft.type}
                onChange={next => applyPatch({ type: next })}
                taskTypes={taskTypes}
                onRegisterType={registerTaskType}
                disabled={saving}
              />
            ) : (
              <ReadonlyValue><IssueTypeLabel type={draft.type} /></ReadonlyValue>
            )}
          </div>

          <div className="appdev-field">
            {caps.canChangeStatus ? (
              <StatusPick
                legend={t('appdev.board.status')}
                value={draft.status}
                options={statusOptions}
                labelFor={status => t(`appdev.status.${status}`)}
                onChange={setStatus}
                disabled={saving}
              />
            ) : (
              <>
                <span>{t('appdev.board.status')}</span>
                <ReadonlyValue className="appdev-status-readonly">
                  <span className={`appdev-status-pick-option is-${draft.status} is-active is-readonly`}>
                    {t(`appdev.status.${draft.status}`)}
                  </span>
                </ReadonlyValue>
              </>
            )}
          </div>

          <div className="appdev-field-row">
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
              <span>{t('appdev.board.issuedAt')}</span>
              <ReadonlyValue>{formatIssueDate(draft.created_at, locale)}</ReadonlyValue>
            </div>
          </div>

          <div className="appdev-field-row">
            <div className="appdev-field">
              <span>{t('appdev.board.assignedAt')}</span>
              {caps.canEditDates ? (
                <DatePicker
                  id="issue-assigned-at"
                  value={draft.assigned_at}
                  onChange={v => applyPatch({ assigned_at: v })}
                  disabled={saving}
                  locale={locale}
                  placeholder={t('appdev.board.pickDate')}
                />
              ) : (
                <ReadonlyValue>{formatIssueDate(draft.assigned_at, locale)}</ReadonlyValue>
              )}
            </div>
            <div className="appdev-field">
              <span>{t('appdev.board.dueAt')}</span>
              {caps.canEditDueDate ? (
                <DatePicker
                  id="issue-due-at"
                  value={draft.due_at}
                  onChange={v => applyPatch({ due_at: v })}
                  disabled={saving}
                  locale={locale}
                  placeholder={t('appdev.board.pickDate')}
                />
              ) : (
                <ReadonlyValue>{formatIssueDate(draft.due_at, locale)}</ReadonlyValue>
              )}
            </div>
          </div>

          <div className="appdev-field">
            <span>{t('appdev.board.completedAt')}</span>
            {caps.canEditDates ? (
              <DatePicker
                id="issue-completed-at"
                value={draft.completed_at}
                onChange={v => applyPatch({ completed_at: v })}
                disabled={saving || draft.status !== 'done'}
                locale={locale}
                placeholder={t('appdev.board.pickDate')}
              />
            ) : (
              <ReadonlyValue>{formatIssueDate(draft.completed_at, locale)}</ReadonlyValue>
            )}
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
          {caps.canDelete && !isDraft ? (
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
            {isDraft ? (
              <>
                <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
                  {t('appdev.board.cancel')}
                </button>
                <button
                  type="button"
                  className="appdev-btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? t('appdev.board.saving') : t('appdev.board.createTask')}
                </button>
              </>
            ) : (
              <button type="button" className="btn-ghost" onClick={handleClose} disabled={saving}>
                {saving ? t('appdev.board.saving') : t('appdev.board.close')}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </>
  );
}
