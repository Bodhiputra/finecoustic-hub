'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DatePicker from '@/components/appdev/DatePicker';
import MediaUrlFields from '@/components/appdev/MediaUrlFields';
import IssueChat from '@/components/appdev/IssueChat';
import Icon from '@/components/Icon';
import {
  ALL_DEPARTMENTS_ID,
  DEFAULT_SUBTYPES,
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  VISIBILITY,
  deptText,
} from '@/lib/internal';
import { statusColumnLabel } from '@/lib/internal-campaigns';
import { getWorkflowActions } from '@/lib/task-workflow';
import { useLocale } from '@/components/LocaleProvider';
import { uploadInternalMediaFile } from '@/lib/hub-upload-client';

function normalizeDraftForPanel(task) {
  if (!task) return task;
  if (task.kind === 'event') {
    const start = task.planned_for || task.deadline || null;
    const end = task.deadline || task.planned_for || null;
    return {
      ...task,
      kind: 'milestone',
      planned_for: start,
      deadline: end,
    };
  }
  if (task.kind === 'milestone') {
    const start = task.planned_for || task.deadline || null;
    const end = task.deadline || task.planned_for || null;
    return { ...task, planned_for: start, deadline: end };
  }
  return {
    ...task,
    deadline: task.deadline || task.planned_for || null,
    planned_for: null,
  };
}

function prepareSave(draft, lockDepartmentId, lockBoard = null, isNew = false) {
  const kind = draft.kind === 'event' ? 'milestone' : (draft.kind || 'task');
  let next = { ...draft };
  if (lockDepartmentId && lockDepartmentId !== ALL_DEPARTMENTS_ID) {
    next.department = lockDepartmentId;
  }
  if (lockBoard?.board_id) next.board_id = lockBoard.board_id;
  if (lockBoard?.campaign_id) next.campaign_id = lockBoard.campaign_id;
  if (kind === 'milestone') {
    let start = draft.planned_for || draft.deadline || null;
    let end = draft.deadline || draft.planned_for || null;
    if (start && end && start > end) {
      const swap = start;
      start = end;
      end = swap;
    }
    if (start && !end) end = start;
    if (end && !start) start = end;
    return { ...next, kind: 'milestone', planned_for: start, deadline: end };
  }
  if (kind === 'task') {
    if (isNew) next.status = 'todo';
    else delete next.status;
  }
  return { ...next, kind: 'task', planned_for: null };
}

const PRIORITY_KEYS = {
  none: 'hub.internal.priorityNone',
  urgent: 'hub.internal.priorityUrgent',
  high: 'hub.internal.priorityHigh',
  medium: 'hub.internal.priorityMedium',
  low: 'hub.internal.priorityLow',
};

const VISIBILITY_KEYS = {
  team: 'hub.internal.visibilityTeam',
  private: 'hub.internal.visibilityPrivate',
};

const MILESTONE_STATUS_VALUES = [
  { id: 'todo', labelKey: 'hub.internal.taskPanel.milestoneScheduled' },
  { id: 'done', labelKey: 'hub.internal.taskPanel.milestoneCompleted' },
  { id: 'cancelled', labelKey: 'hub.internal.taskPanel.milestoneCancelled' },
];

/** Single choice — pill toggles (not a dropdown). */
function HubSinglePick({ legend, name, value, options, onChange, disabled = false }) {
  return (
    <fieldset className="hub-single-pick appdev-field">
      <legend className="hub-single-pick-label">{legend}</legend>
      <div className="hub-single-pick-options" role="radiogroup" aria-label={legend}>
        {options.map(opt => (
          <label
            key={opt.value}
            className={`hub-single-pick-option${value === opt.value ? ' is-active' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SubtasksEditor({ subtasks = [], onChange, disabled, t }) {
  const [draftTitle, setDraftTitle] = useState('');

  function addSubtask() {
    const title = draftTitle.trim();
    if (!title) return;
    onChange([
      ...subtasks,
      { id: crypto.randomUUID(), title, done: false },
    ]);
    setDraftTitle('');
  }

  function toggle(id) {
    onChange(subtasks.map(s => (s.id === id ? { ...s, done: !s.done } : s)));
  }

  function remove(id) {
    onChange(subtasks.filter(s => s.id !== id));
  }

  return (
    <div className="internal-subtasks">
      <span className="internal-subtasks-label">{t('hub.internal.taskPanel.subtasks')}</span>
      <ul className="internal-subtasks-list">
        {subtasks.map(s => (
          <li key={s.id} className="internal-subtask-row">
            <label className="internal-subtask-check">
              <input
                type="checkbox"
                checked={Boolean(s.done)}
                onChange={() => toggle(s.id)}
                disabled={disabled}
              />
              <span className={s.done ? 'is-done' : ''}>{s.title}</span>
            </label>
            <button
              type="button"
              className="internal-subtask-remove"
              onClick={() => remove(s.id)}
              disabled={disabled}
              aria-label={t('hub.internal.taskPanel.removeSubtask')}
            >
              <Icon name="x" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="internal-subtask-add">
        <input
          type="text"
          value={draftTitle}
          onChange={e => setDraftTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSubtask();
            }
          }}
          placeholder={t('hub.internal.taskPanel.addSubtask')}
          disabled={disabled}
        />
        <button type="button" className="btn-ghost" onClick={addSubtask} disabled={disabled || !draftTitle.trim()}>
          {t('hub.internal.taskPanel.add')}
        </button>
      </div>
    </div>
  );
}

const WORKFLOW_ACTION_KEYS = {
  accept: 'hub.internal.workflow.accept',
  request_review: 'hub.internal.workflow.requestReview',
  approve: 'hub.internal.workflow.approve',
  send_back: 'hub.internal.workflow.sendBack',
};

function TaskWorkflowSection({ task, displayName, statusColumns, onAction, busy, t }) {
  const status = task?.status || 'todo';
  const statusLabel = useMemo(() => {
    const col = statusColumns?.find(c => (typeof c === 'string' ? c : c.id) === status);
    if (col) return statusColumnLabel(col, t);
    const key = {
      todo: 'hub.internal.statusTodo',
      in_progress: 'hub.internal.statusInProgress',
      in_review: 'hub.internal.statusInReview',
      done: 'hub.internal.statusDone',
      cancelled: 'hub.internal.statusCancelled',
    }[status];
    return key ? t(key) : status.replace(/_/g, ' ');
  }, [status, statusColumns, t]);

  const actions = useMemo(
    () => getWorkflowActions(task, displayName),
    [task, displayName]
  );

  return (
    <div className="task-workflow">
      <div className="task-workflow-status">
        <span className="task-workflow-status-label">{t('hub.internal.taskPanel.status')}</span>
        <span className={`task-workflow-badge is-${status}`}>{statusLabel}</span>
      </div>
      {actions.length > 0 && onAction ? (
        <div className="task-workflow-actions">
          {actions.map(action => (
            <button
              key={action}
              type="button"
              className={action === 'approve' ? 'appdev-btn-primary' : 'btn-ghost'}
              disabled={busy}
              onClick={() => onAction(task.id, action)}
            >
              {t(WORKFLOW_ACTION_KEYS[action] || action)}
            </button>
          ))}
        </div>
      ) : (
        <p className="appdev-field-hint">{t('hub.internal.workflow.noActions')}</p>
      )}
    </div>
  );
}

export default function TaskPanel({
  task,
  onClose,
  onSave,
  onDelete,
  onPostComment,
  onWorkflowAction,
  saving = false,
  postingComment = false,
  workflowBusy = false,
  displayName = '',
  lockDepartmentId = null,
  lockBoard = null,
  statusColumns = null,
  teamMembers = [],
}) {
  const { locale, t } = useLocale();
  const [draft, setDraft] = useState(task);
  const isNew = Boolean(task?._draft || !task?.id);
  const isMilestone = draft.kind === 'milestone';
  const isTask = !isMilestone;
  const hideDepartment = Boolean(lockDepartmentId && lockDepartmentId !== ALL_DEPARTMENTS_ID);
  const uploadMedia = useCallback((file, kind) => uploadInternalMediaFile(file, kind), []);

  useEffect(() => {
    setDraft(normalizeDraftForPanel(task));
  }, [task]);

  const subtypeOptions = useMemo(
    () => DEFAULT_SUBTYPES[draft?.department] || [],
    [draft?.department]
  );

  const statusOptions = useMemo(() => {
    if (statusColumns?.length) return statusColumns;
    return TASK_STATUSES.filter(s => s !== 'archived').map(id => ({ id, label: id }));
  }, [statusColumns]);

  const assigneeOptions = useMemo(() => {
    const names = new Set(teamMembers.filter(Boolean));
    if (draft?.assignee) names.add(draft.assignee);
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [teamMembers, draft?.assignee]);

  const priorityPickOptions = useMemo(
    () => TASK_PRIORITIES.map(p => ({
      value: p,
      label: t(PRIORITY_KEYS[p] || p),
    })),
    [t]
  );

  const visibilityPickOptions = useMemo(
    () => VISIBILITY.map(v => ({
      value: v,
      label: t(VISIBILITY_KEYS[v] || v),
    })),
    [t]
  );

  const milestoneStatusPickOptions = useMemo(
    () => MILESTONE_STATUS_VALUES.map(opt => ({
      value: opt.id,
      label: t(opt.labelKey),
    })),
    [t]
  );

  if (!task) return null;

  const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

  const panelTitle = isNew
    ? isMilestone
      ? t('hub.internal.taskPanel.newMilestone')
      : t('hub.internal.taskPanel.newTask')
    : isMilestone
      ? t('hub.internal.taskPanel.milestone')
      : t('hub.internal.taskPanel.task');

  const canSave = Boolean(draft.title?.trim());

  return (
    <>
      <button type="button" className="appdev-overlay" onClick={onClose} aria-label={t('hub.internal.close')} />
      <aside className="appdev-panel internal-task-panel" role="dialog" aria-modal="true" aria-labelledby="internal-panel-title">
        <header className={`appdev-panel-head${isNew ? ' appdev-panel-head--draft' : ''}`}>
          <span className="appdev-issue-id" id="internal-panel-title">{panelTitle}</span>
          <button type="button" className="appdev-panel-close" onClick={onClose} aria-label={t('hub.internal.close')}>
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
              placeholder={t('hub.internal.taskPanel.titlePlaceholder')}
              autoFocus
            />
          </div>

          <div className="appdev-field">
            <span>{t('hub.internal.taskPanel.description')}</span>
            <textarea
              rows={5}
              value={draft.notes || ''}
              onChange={e => set('notes', e.target.value)}
              disabled={saving}
              placeholder={t('hub.internal.taskPanel.descriptionPlaceholder')}
            />
          </div>

          {isTask && (
            <MediaUrlFields
              imageUrls={draft.image_urls || []}
              videoUrls={draft.video_urls || []}
              onChangeImages={urls => set('image_urls', urls)}
              onChangeVideos={urls => set('video_urls', urls)}
              t={t}
              disabled={saving}
              canManageMedia
              uploadMediaFile={uploadMedia}
            />
          )}

          {isTask && (
            <SubtasksEditor
              subtasks={draft.subtasks || []}
              onChange={next => set('subtasks', next)}
              disabled={saving}
              t={t}
            />
          )}

          {!hideDepartment ? (
            <label className="appdev-field">
              <span>{t('hub.internal.taskPanel.department')}</span>
              <select
                value={draft.department || 'operations'}
                onChange={e => set('department', e.target.value)}
                disabled={saving}
              >
                <option value={ALL_DEPARTMENTS_ID}>{t('hub.internal.allDepartments')}</option>
                {DEPARTMENTS.map(d => (
                  <option key={d.id} value={d.id}>{deptText(d, t, 'label')}</option>
                ))}
              </select>
            </label>
          ) : null}

          {isTask ? (
            <>
              <div className="appdev-field-row">
                <label className="appdev-field">
                  <span>{t('hub.internal.taskPanel.subtype')}</span>
                  <input
                    list="internal-subtype-options"
                    value={draft.subtype || ''}
                    onChange={e => set('subtype', e.target.value)}
                    disabled={saving}
                    placeholder={t('hub.internal.taskPanel.subtypePlaceholder')}
                  />
                  <datalist id="internal-subtype-options">
                    {subtypeOptions.map(opt => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </label>
              </div>

              <HubSinglePick
                legend={t('hub.internal.taskPanel.priority')}
                name="task-priority"
                value={draft.priority || 'none'}
                options={priorityPickOptions}
                onChange={v => set('priority', v)}
                disabled={saving}
              />

              {!isNew ? (
                <TaskWorkflowSection
                  task={draft}
                  displayName={displayName}
                  statusColumns={statusOptions}
                  onAction={onWorkflowAction}
                  busy={saving || workflowBusy}
                  t={t}
                />
              ) : (
                <p className="appdev-field-hint">{t('hub.internal.workflow.newTaskHint')}</p>
              )}

              <HubSinglePick
                legend={t('hub.internal.taskPanel.visibility')}
                name="task-visibility"
                value={draft.visibility || 'team'}
                options={visibilityPickOptions}
                onChange={v => set('visibility', v)}
                disabled={saving}
              />
            </>
          ) : null}

          {isMilestone && (
            <>
              <div className="appdev-field-row">
                <label className="appdev-field">
                  <span>{t('hub.internal.taskPanel.eventStart')}</span>
                  <DatePicker
                    value={draft.planned_for}
                    onChange={v => set('planned_for', v)}
                    disabled={saving}
                    locale={locale}
                    placeholder={t('hub.internal.taskPanel.pickDate')}
                  />
                </label>
                <label className="appdev-field">
                  <span>{t('hub.internal.taskPanel.eventEnd')}</span>
                  <DatePicker
                    value={draft.deadline}
                    onChange={v => set('deadline', v)}
                    disabled={saving}
                    locale={locale}
                    placeholder={t('hub.internal.taskPanel.pickDate')}
                  />
                </label>
              </div>
              <HubSinglePick
                legend={t('hub.internal.taskPanel.milestoneStatus')}
                name="milestone-status"
                value={draft.status === 'done' ? 'done' : draft.status === 'cancelled' ? 'cancelled' : 'todo'}
                options={milestoneStatusPickOptions}
                onChange={v => set('status', v)}
                disabled={saving}
              />
              <p className="appdev-field-hint">{t('hub.internal.taskPanel.milestoneHint')}</p>
            </>
          )}

          {isTask && (
            <div className="appdev-field">
              <span>{t('hub.internal.taskPanel.deadline')}</span>
              <DatePicker
                value={draft.deadline}
                onChange={v => set('deadline', v)}
                disabled={saving}
                locale={locale}
                placeholder={t('hub.internal.taskPanel.pickDate')}
              />
              <span className="appdev-field-hint">{t('hub.internal.taskPanel.dueDateHint')}</span>
            </div>
          )}

          {isTask && (
            <label className="appdev-field">
              <span>{t('hub.internal.taskPanel.assignee')}</span>
              <select
                value={draft.assignee || ''}
                onChange={e => set('assignee', e.target.value)}
                disabled={saving}
              >
                <option value="">{t('hub.internal.taskPanel.assigneeUnassigned')}</option>
                {assigneeOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="appdev-field">
            <span>{t('hub.internal.taskPanel.link')}</span>
            <input
              value={draft.link_url || ''}
              onChange={e => set('link_url', e.target.value)}
              disabled={saving}
              placeholder={t('hub.internal.taskPanel.linkPlaceholder')}
            />
          </div>

          {isTask && onPostComment && (
            isNew ? (
              <p className="appdev-panel-notice" role="note">
                {t('appdev.chat.saveFirst')}
              </p>
            ) : (
              <IssueChat
                comments={draft.comments || []}
                displayName={displayName}
                onPost={payload => onPostComment(draft.id, payload)}
                posting={postingComment}
                canPost
                t={t}
                locale={locale}
                uploadMediaFile={uploadMedia}
              />
            )
          )}
        </div>

        <footer className="appdev-panel-foot">
          {onDelete && draft.id && !isNew ? (
            <button type="button" className="appdev-btn-danger" onClick={() => onDelete(draft.id)} disabled={saving}>
              {t('hub.internal.taskPanel.delete')}
            </button>
          ) : (
            <span />
          )}
          <div className="appdev-panel-foot-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              {t('hub.internal.taskPanel.cancel')}
            </button>
            <button
              type="button"
              className="appdev-btn-primary"
              onClick={() => onSave(prepareSave(draft, lockDepartmentId, lockBoard, isNew))}
              disabled={saving || !canSave}
            >
              {saving ? t('hub.internal.taskPanel.saving') : isNew ? t('hub.internal.taskPanel.create') : t('hub.internal.taskPanel.save')}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
