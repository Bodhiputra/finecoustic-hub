'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IssueChat from '@/components/appdev/IssueChat';
import Icon from '@/components/Icon';
import ModalPortal from '@/components/ModalPortal';
import TaskAttachmentFields from '@/components/internal/TaskAttachmentFields';
import TaskCustomFields from '@/components/internal/TaskCustomFields';
import TaskDateTimeField from '@/components/internal/TaskDateTimeField';
import {
  ALL_DEPARTMENTS_ID,
  DEFAULT_SUBTYPES,
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  buildTeamAssigneeOptions,
  deptText,
  getDepartment,
} from '@/lib/internal';
import { statusColumnLabel } from '@/lib/internal-campaigns';
import { getWorkflowActions } from '@/lib/task-workflow';
import { getTaskPanelCapabilities } from '@/lib/internal-task-panel-permissions';
import { buildMentionKnownNames } from '@/lib/mention-parse';
import { HARDCODED_MASTER_NAMES } from '@/lib/appdev-constants';
import { TASK_RECURRENCES } from '@/lib/task-recurrence';
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
  if (task.kind === 'milestone' || task.kind === 'meeting') {
    const start = task.planned_for || task.deadline || null;
    const end = task.deadline || task.planned_for || null;
    return {
      ...task,
      kind: task.kind,
      planned_for: start,
      deadline: end,
    };
  }
  return {
    ...task,
    deadline: task.deadline || task.planned_for || null,
    planned_for: null,
  };
}

function prepareSave(draft, lockDepartmentId, lockBoard = null, isNew = false, { lockAssigneeToSelf = false, displayName = '' } = {}) {
  const kind = draft.kind === 'event' ? 'milestone' : (draft.kind || 'task');
  let next = { ...draft };
  if (lockDepartmentId && lockDepartmentId !== ALL_DEPARTMENTS_ID) {
    next.department = lockDepartmentId;
  }
  if (lockBoard?.board_id) next.board_id = lockBoard.board_id;
  if (lockBoard?.campaign_id) next.campaign_id = lockBoard.campaign_id;
  if (lockAssigneeToSelf && displayName) {
    next.assignee = displayName;
  }
  if (kind === 'milestone' || kind === 'meeting') {
    let start = draft.planned_for || draft.deadline || null;
    let end = draft.deadline || draft.planned_for || null;
    if (start && end && start > end) {
      const swap = start;
      start = end;
      end = swap;
    }
    if (start && !end) end = start;
    if (end && !start) start = end;
    return { ...next, kind, planned_for: start, deadline: end };
  }
  if (kind === 'task') {
    if (isNew) next.status = draft.status || 'todo';
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

const RECURRENCE_KEYS = {
  none: 'hub.internal.recurrenceNone',
  daily: 'hub.internal.recurrenceDaily',
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

/** Read-only field value for assignee view. */
function ReadonlyValue({ children, className = '' }) {
  return <div className={`appdev-readonly-value ${className}`.trim()}>{children || '—'}</div>;
}

/** Multi choice — same pill UI; click to toggle each person. */
function HubMultiPick({ legend, name, value = [], options = [], onChange, disabled = false }) {
  const selected = new Set(Array.isArray(value) ? value : []);

  function toggle(optValue) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(optValue)) next.delete(optValue);
    else next.add(optValue);
    onChange(
      [...next].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    );
  }

  return (
    <fieldset className="hub-single-pick hub-multi-pick appdev-field">
      <legend className="hub-single-pick-label">{legend}</legend>
      <div className="hub-single-pick-options" role="group" aria-label={legend}>
        {options.map(optValue => (
          <label
            key={optValue}
            className={`hub-single-pick-option${selected.has(optValue) ? ' is-active' : ''}`}
          >
            <input
              type="checkbox"
              name={name}
              value={optValue}
              checked={selected.has(optValue)}
              onChange={() => toggle(optValue)}
              disabled={disabled}
            />
            <span>{optValue}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const WORKFLOW_ACTION_KEYS = {
  claim: 'hub.internal.workflow.claim',
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
        <span className="task-workflow-status-label">{t('hub.internal.taskPanel.workflowStep')}</span>
        <span className={`task-workflow-badge is-${status}`}>{statusLabel}</span>
      </div>
      <p className="appdev-field-hint">{t('hub.internal.taskPanel.workflowStatusHint')}</p>
      {actions.length > 0 && onAction ? (
        <div className="task-workflow-actions">
          {actions.map(action => (
            <button
              key={action}
              type="button"
              className={action === 'approve' || action === 'claim' ? 'appdev-btn-primary' : 'btn-ghost'}
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
  boardCustomProperties = [],
  onManageBoardFields,
  teamMembers = [],
  lockAssigneeToSelf = false,
  isManager = false,
  isAdmin = false,
}) {
  const { locale, t } = useLocale();
  const [draft, setDraft] = useState(task);
  const isNew = Boolean(task?._draft || !task?.id);
  const isMeeting = draft.kind === 'meeting';
  const isMilestone = draft.kind === 'milestone';
  const isTask = draft.kind === 'task';
  const isCalendarItem = isMilestone || isMeeting;
  const hideDepartment = Boolean(lockDepartmentId && lockDepartmentId !== ALL_DEPARTMENTS_ID);
  const uploadMedia = useCallback((file, kind) => uploadInternalMediaFile(file, kind), []);
  const attachmentRef = useRef(null);
  const panelDragCounter = useRef(0);
  const [panelDragging, setPanelDragging] = useState(false);

  const caps = useMemo(
    () => getTaskPanelCapabilities(draft, { displayName, isManager, isAdmin }),
    [draft, displayName, isManager, isAdmin]
  );

  const hasFilePayload = useCallback(e => {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    return typeof types.includes === 'function'
      ? types.includes('Files')
      : Array.from(types).includes('Files');
  }, []);

  const onPanelDragEnter = useCallback(e => {
    if (!isTask || saving || !caps.canManageAttachments || !hasFilePayload(e)) return;
    e.preventDefault();
    panelDragCounter.current += 1;
    setPanelDragging(true);
  }, [hasFilePayload, isTask, saving, caps.canManageAttachments]);

  const onPanelDragLeave = useCallback(e => {
    if (!isTask || saving || !caps.canManageAttachments) return;
    e.preventDefault();
    panelDragCounter.current -= 1;
    if (panelDragCounter.current <= 0) {
      panelDragCounter.current = 0;
      setPanelDragging(false);
    }
  }, [isTask, saving, caps.canManageAttachments]);

  const onPanelDragOver = useCallback(e => {
    if (!isTask || saving || !caps.canManageAttachments || !hasFilePayload(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [hasFilePayload, isTask, saving, caps.canManageAttachments]);

  const onPanelDrop = useCallback(e => {
    if (!isTask || saving || !caps.canManageAttachments) return;
    e.preventDefault();
    panelDragCounter.current = 0;
    setPanelDragging(false);
    if (e.dataTransfer?.files?.length) {
      attachmentRef.current?.processFiles?.(e.dataTransfer.files);
    }
  }, [isTask, saving, caps.canManageAttachments]);

  useEffect(() => {
    setDraft(normalizeDraftForPanel(task));
  }, [task]);

  const subtypeOptions = useMemo(
    () => DEFAULT_SUBTYPES[draft?.department] || [],
    [draft?.department]
  );

  const statusOptions = useMemo(() => {
    if (statusColumns?.length) {
      return statusColumns.map(col =>
        typeof col === 'string'
          ? { id: col, label: statusColumnLabel({ id: col }, t) }
          : { ...col, label: statusColumnLabel(col, t) }
      );
    }
    return TASK_STATUSES.filter(s => s !== 'archived').map(id => ({
      id,
      label: statusColumnLabel({ id }, t),
    }));
  }, [statusColumns, t]);

  const assigneeOptions = useMemo(() => {
    if (lockAssigneeToSelf && displayName) return [displayName];
    return buildTeamAssigneeOptions(teamMembers, {
      displayName,
      extraNames: [draft?.assignee, draft?.created_by],
    });
  }, [teamMembers, draft?.assignee, draft?.created_by, lockAssigneeToSelf, displayName]);

  const mentionNames = useMemo(
    () => buildMentionKnownNames(assigneeOptions, HARDCODED_MASTER_NAMES),
    [assigneeOptions]
  );

  const priorityPickOptions = useMemo(
    () => TASK_PRIORITIES.map(p => ({
      value: p,
      label: t(PRIORITY_KEYS[p] || p),
    })),
    [t]
  );

  const recurrencePickOptions = useMemo(
    () => TASK_RECURRENCES.map(value => ({
      value,
      label: t(RECURRENCE_KEYS[value] || value),
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
    ? isMeeting
      ? t('hub.internal.taskPanel.newMeeting')
      : isMilestone
        ? t('hub.internal.taskPanel.newMilestone')
        : t('hub.internal.taskPanel.newTask')
    : isMeeting
      ? t('hub.internal.taskPanel.meeting')
      : isMilestone
        ? t('hub.internal.taskPanel.milestone')
        : t('hub.internal.taskPanel.task');

  const canSave = Boolean(draft.title?.trim()) && caps.canSavePanel;
  const showContributorNotice = !isNew && caps.isAssignee && !caps.isAssigner && isTask;

  return (
    <ModalPortal>
      <div
        className={`internal-task-panel-layer${panelDragging ? ' is-attachment-dragover' : ''}`}
        onDragEnter={onPanelDragEnter}
        onDragLeave={onPanelDragLeave}
        onDragOver={onPanelDragOver}
        onDrop={onPanelDrop}
      >
        <button
          type="button"
          className="appdev-overlay"
          onClick={onClose}
          aria-label={t('hub.internal.close')}
        />
        <aside
          className="appdev-panel internal-task-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="internal-panel-title"
        >
        <header className={`appdev-panel-head${isNew ? ' appdev-panel-head--draft' : ''}`}>
          <span className="appdev-issue-id" id="internal-panel-title">{panelTitle}</span>
          <button type="button" className="appdev-panel-close" onClick={onClose} aria-label={t('hub.internal.close')}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="appdev-panel-body">
          {showContributorNotice ? (
            <p className="appdev-contributor-notice" role="note">
              {t('hub.internal.taskPanel.contributorNotice').replace('{assigner}', draft.created_by || '—')}
            </p>
          ) : null}

          <div className="appdev-field">
            <span>{t('hub.internal.taskPanel.title')}</span>
            {caps.canEditMetadata ? (
              <input
                value={draft.title || ''}
                onChange={e => set('title', e.target.value)}
                disabled={saving}
                placeholder={t('hub.internal.taskPanel.titlePlaceholder')}
                autoFocus
              />
            ) : (
              <ReadonlyValue>{draft.title}</ReadonlyValue>
            )}
          </div>

          <div className="appdev-field">
            <span>{t('hub.internal.taskPanel.description')}</span>
            {caps.canEditMetadata ? (
              <textarea
                rows={5}
                value={draft.notes || ''}
                onChange={e => set('notes', e.target.value)}
                disabled={saving}
                placeholder={t('hub.internal.taskPanel.descriptionPlaceholder')}
              />
            ) : (
              <ReadonlyValue className="appdev-readonly-multiline">
                {draft.notes || t('appdev.board.noDescription')}
              </ReadonlyValue>
            )}
          </div>

          {isTask && (
            <TaskAttachmentFields
              ref={attachmentRef}
              imageUrls={draft.image_urls || []}
              videoUrls={draft.video_urls || []}
              fileUrls={draft.file_urls || []}
              onChangeImages={urls => set('image_urls', urls)}
              onChangeVideos={urls => set('video_urls', urls)}
              onChangeFiles={files => set('file_urls', files)}
              t={t}
              disabled={saving}
              canManage={caps.canManageAttachments}
            />
          )}

          {!hideDepartment && !isMeeting ? (
            caps.canEditMetadata ? (
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
            ) : (
            <div className="appdev-field">
              <span>{t('hub.internal.taskPanel.department')}</span>
              <ReadonlyValue>{deptText(getDepartment(draft.department), t, 'label') || draft.department}</ReadonlyValue>
            </div>
            )
          ) : null}

          {isTask ? (
            <>
              {caps.canEditMetadata ? (
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
              ) : draft.subtype ? (
              <div className="appdev-field">
                <span>{t('hub.internal.taskPanel.subtype')}</span>
                <ReadonlyValue>{draft.subtype}</ReadonlyValue>
              </div>
              ) : null}

              {caps.canEditMetadata ? (
              <>
              <HubSinglePick
                legend={t('hub.internal.taskPanel.priority')}
                name="task-priority"
                value={draft.priority || 'none'}
                options={priorityPickOptions}
                onChange={v => set('priority', v)}
                disabled={saving}
              />

              <HubSinglePick
                legend={t('hub.internal.taskPanel.recurrence')}
                name="task-recurrence"
                value={draft.recurrence || 'none'}
                options={recurrencePickOptions}
                onChange={v => set('recurrence', v)}
                disabled={saving}
              />
              {draft.recurrence === 'daily' ? (
                <p className="appdev-field-hint">{t('hub.internal.recurrenceDailyHint')}</p>
              ) : null}
              </>
              ) : null}

              {!isNew && caps.canUseWorkflow ? (
                <TaskWorkflowSection
                  task={draft}
                  displayName={displayName}
                  statusColumns={statusOptions}
                  onAction={onWorkflowAction}
                  busy={saving || workflowBusy}
                  t={t}
                />
              ) : isNew && caps.canEditMetadata ? (
                <p className="appdev-field-hint">{t('hub.internal.workflow.newTaskHint')}</p>
              ) : null}
            </>
          ) : null}

          {isTask && (boardCustomProperties.length > 0 || onManageBoardFields) ? (
            <TaskCustomFields
              properties={boardCustomProperties}
              values={draft.custom_values || {}}
              onChange={values => set('custom_values', values)}
              onManageFields={caps.canManageCustomFields ? onManageBoardFields : undefined}
              disabled={saving || !caps.canManageCustomFields}
              teamMembers={assigneeOptions}
              locale={locale}
            />
          ) : null}

          {isMeeting && caps.canEditCalendarFields && (
            <>
              <HubSinglePick
                legend={t('hub.internal.meetingScope')}
                name="meeting-scope"
                value={draft.meeting_scope || 'all'}
                options={[
                  { value: 'all', label: t('hub.internal.meetingScopeAll') },
                  { value: 'department', label: t('hub.internal.meetingScopeDepartment') },
                  { value: 'individual', label: t('hub.internal.meetingScopeIndividual') },
                ]}
                onChange={v => set('meeting_scope', v)}
                disabled={saving}
              />
              {draft.meeting_scope === 'department' ? (
                <label className="appdev-field">
                  <span>{t('hub.internal.taskPanel.department')}</span>
                  <select
                    value={draft.meeting_department || draft.department || 'operations'}
                    onChange={e => set('meeting_department', e.target.value)}
                    disabled={saving}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{deptText(d, t, 'label')}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {draft.meeting_scope === 'individual' ? (
                <div className="appdev-field">
                  <HubMultiPick
                    legend={t('hub.internal.meetingAttendees')}
                    name="meeting-attendees"
                    value={draft.meeting_attendees || []}
                    options={assigneeOptions}
                    onChange={names => set('meeting_attendees', names)}
                    disabled={saving}
                  />
                  <span className="appdev-field-hint">{t('hub.internal.meetingAttendeesHint')}</span>
                </div>
              ) : null}
            </>
          )}

          {isCalendarItem && (
            <>
              <div className="appdev-field-row task-datetime-row-pair">
                <TaskDateTimeField
                  dateLabel={t('hub.internal.taskPanel.eventStart')}
                  timeLabel={t('hub.internal.taskPanel.startTime')}
                  dateValue={draft.planned_for}
                  timeValue={draft.planned_for_time}
                  onDateChange={v => set('planned_for', v)}
                  onTimeChange={v => set('planned_for_time', v)}
                  disabled={saving || !caps.canEditCalendarFields}
                  locale={locale}
                  datePlaceholder={t('hub.internal.taskPanel.pickDate')}
                  timePlaceholder={t('hub.internal.taskPanel.pickTime')}
                />
                <TaskDateTimeField
                  dateLabel={t('hub.internal.taskPanel.eventEnd')}
                  timeLabel={t('hub.internal.taskPanel.endTime')}
                  dateValue={draft.deadline}
                  timeValue={draft.deadline_time}
                  onDateChange={v => set('deadline', v)}
                  onTimeChange={v => set('deadline_time', v)}
                  disabled={saving || !caps.canEditCalendarFields}
                  locale={locale}
                  datePlaceholder={t('hub.internal.taskPanel.pickDate')}
                  timePlaceholder={t('hub.internal.taskPanel.pickTime')}
                />
              </div>
              {isMilestone ? (
                <>
                  {caps.canEditCalendarFields ? (
                  <HubSinglePick
                    legend={t('hub.internal.taskPanel.milestoneStatus')}
                    name="milestone-status"
                    value={draft.status === 'done' ? 'done' : draft.status === 'cancelled' ? 'cancelled' : 'todo'}
                    options={milestoneStatusPickOptions}
                    onChange={v => set('status', v)}
                    disabled={saving}
                  />
                  ) : (
                  <div className="appdev-field">
                    <span>{t('hub.internal.taskPanel.milestoneStatus')}</span>
                    <ReadonlyValue>
                      {milestoneStatusPickOptions.find(o => o.value === (draft.status === 'done' ? 'done' : draft.status === 'cancelled' ? 'cancelled' : 'todo'))?.label || draft.status}
                    </ReadonlyValue>
                  </div>
                  )}
                  <p className="appdev-field-hint">{t('hub.internal.taskPanel.milestoneHint')}</p>
                </>
              ) : (
                <p className="appdev-field-hint">{t('hub.internal.meetingHint')}</p>
              )}
            </>
          )}

          {isTask && (
            <>
              <TaskDateTimeField
                dateLabel={t('hub.internal.taskPanel.deadline')}
                timeLabel={t('hub.internal.taskPanel.dueTime')}
                dateValue={draft.deadline}
                timeValue={draft.deadline_time}
                onDateChange={v => set('deadline', v)}
                onTimeChange={v => set('deadline_time', v)}
                disabled={saving || !caps.canEditMetadata}
                locale={locale}
                datePlaceholder={t('hub.internal.taskPanel.pickDate')}
                timePlaceholder={t('hub.internal.taskPanel.pickTime')}
              />
              {caps.canEditMetadata ? (
                <p className="appdev-field-hint">{t('hub.internal.taskPanel.dueDateHint')}</p>
              ) : null}
            </>
          )}

          {isTask && !isNew && draft.created_by ? (
            <div className="appdev-field">
              <span>{t('hub.internal.taskPanel.assigner')}</span>
              <ReadonlyValue>{draft.created_by}</ReadonlyValue>
            </div>
          ) : null}

          {isTask && (
            lockAssigneeToSelf ? (
              <div className="appdev-field">
                <span>{t('hub.internal.taskPanel.assignee')}</span>
                <input value={displayName} readOnly disabled aria-readonly="true" />
              </div>
            ) : caps.canEditAssignee ? (
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
            ) : (
              <div className="appdev-field">
                <span>{t('hub.internal.taskPanel.assignee')}</span>
                <ReadonlyValue>{draft.assignee || t('hub.internal.taskPanel.assigneeUnassigned')}</ReadonlyValue>
              </div>
            )
          )}

          {isTask && onPostComment && caps.canComment && (
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
                mentionNames={mentionNames}
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
              {caps.canSavePanel ? t('hub.internal.taskPanel.cancel') : t('hub.internal.close')}
            </button>
            {caps.canSavePanel ? (
            <button
              type="button"
              className="appdev-btn-primary"
              onClick={() =>
                onSave(
                  prepareSave(draft, lockDepartmentId, lockBoard, isNew, {
                    lockAssigneeToSelf,
                    displayName,
                  })
                )
              }
              disabled={saving || !canSave}
            >
              {saving ? t('hub.internal.taskPanel.saving') : isNew ? t('hub.internal.taskPanel.create') : t('hub.internal.taskPanel.save')}
            </button>
            ) : null}
          </div>
        </footer>
      </aside>
      </div>
    </ModalPortal>
  );
}
