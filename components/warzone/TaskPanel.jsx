'use client';

import { useEffect, useMemo, useState } from 'react';
import DatePicker from '@/components/appdev/DatePicker';
import Icon from '@/components/Icon';
import {
  ALL_DEPARTMENTS_ID,
  DEFAULT_SUBTYPES,
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  VISIBILITY,
  deptText,
} from '@/lib/warzone';
import { useLocale } from '@/components/LocaleProvider';

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

function prepareSave(draft) {
  const kind = draft.kind === 'event' ? 'milestone' : (draft.kind || 'task');
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
    return { ...draft, kind: 'milestone', planned_for: start, deadline: end };
  }
  return { ...draft, kind: 'task', planned_for: null };
}

const PRIORITY_KEYS = {
  none: 'hub.warzone.priorityNone',
  urgent: 'hub.warzone.priorityUrgent',
  high: 'hub.warzone.priorityHigh',
  medium: 'hub.warzone.priorityMedium',
  low: 'hub.warzone.priorityLow',
};

const STATUS_KEYS = {
  todo: 'hub.warzone.statusTodo',
  in_progress: 'hub.warzone.statusInProgress',
  in_review: 'hub.warzone.statusInReview',
  done: 'hub.warzone.statusDone',
  cancelled: 'hub.warzone.statusCancelled',
  archived: 'hub.warzone.statusArchived',
};

const VISIBILITY_KEYS = {
  team: 'hub.warzone.visibilityTeam',
  private: 'hub.warzone.visibilityPrivate',
};

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
    <div className="warzone-subtasks">
      <span className="warzone-subtasks-label">{t('hub.warzone.taskPanel.subtasks')}</span>
      <ul className="warzone-subtasks-list">
        {subtasks.map(s => (
          <li key={s.id} className="warzone-subtask-row">
            <label className="warzone-subtask-check">
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
              className="warzone-subtask-remove"
              onClick={() => remove(s.id)}
              disabled={disabled}
              aria-label={t('hub.warzone.taskPanel.removeSubtask')}
            >
              <Icon name="x" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="warzone-subtask-add">
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
          placeholder={t('hub.warzone.taskPanel.addSubtask')}
          disabled={disabled}
        />
        <button type="button" className="btn-ghost" onClick={addSubtask} disabled={disabled || !draftTitle.trim()}>
          {t('hub.warzone.taskPanel.add')}
        </button>
      </div>
    </div>
  );
}

export default function TaskPanel({ task, onClose, onSave, onDelete, saving = false }) {
  const { locale, t } = useLocale();
  const [draft, setDraft] = useState(task);
  const isNew = Boolean(task?._draft || !task?.id);
  const isMilestone = draft.kind === 'milestone';
  const isTask = !isMilestone;

  useEffect(() => {
    setDraft(normalizeDraftForPanel(task));
  }, [task]);

  const subtypeOptions = useMemo(
    () => DEFAULT_SUBTYPES[draft?.department] || [],
    [draft?.department]
  );

  if (!task) return null;

  const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

  const panelTitle = isNew
    ? isMilestone
      ? t('hub.warzone.taskPanel.newMilestone')
      : t('hub.warzone.taskPanel.newTask')
    : isMilestone
      ? t('hub.warzone.taskPanel.milestone')
      : t('hub.warzone.taskPanel.task');

  const canSave = Boolean(draft.title?.trim());

  return (
    <>
      <button type="button" className="appdev-overlay" onClick={onClose} aria-label={t('hub.warzone.close')} />
      <aside className="appdev-panel warzone-task-panel" role="dialog" aria-modal="true" aria-labelledby="warzone-panel-title">
        <header className={`appdev-panel-head${isNew ? ' appdev-panel-head--draft' : ''}`}>
          <span className="appdev-issue-id" id="warzone-panel-title">{panelTitle}</span>
          <button type="button" className="appdev-panel-close" onClick={onClose} aria-label={t('hub.warzone.close')}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="appdev-panel-body">
          <div className="appdev-field">
            <span>{t('hub.warzone.taskPanel.title')}</span>
            <input
              value={draft.title || ''}
              onChange={e => set('title', e.target.value)}
              disabled={saving}
              placeholder={t('hub.warzone.taskPanel.titlePlaceholder')}
              autoFocus
            />
          </div>

          <div className="appdev-field">
            <span>{t('hub.warzone.taskPanel.description')}</span>
            <textarea
              rows={5}
              value={draft.notes || ''}
              onChange={e => set('notes', e.target.value)}
              disabled={saving}
              placeholder={t('hub.warzone.taskPanel.descriptionPlaceholder')}
            />
          </div>

          {isTask && (
            <SubtasksEditor
              subtasks={draft.subtasks || []}
              onChange={next => set('subtasks', next)}
              disabled={saving}
              t={t}
            />
          )}

          <div className="appdev-field-row">
            <label className="appdev-field">
              <span>{t('hub.warzone.taskPanel.type')}</span>
              <select
                value={isMilestone ? 'milestone' : 'task'}
                onChange={e => set('kind', e.target.value)}
                disabled={saving}
              >
                <option value="task">{t('hub.warzone.kindTask')}</option>
                <option value="milestone">{t('hub.warzone.kindMilestone')}</option>
              </select>
            </label>
            <label className="appdev-field">
              <span>{t('hub.warzone.taskPanel.department')}</span>
              <select
                value={draft.department || 'operations'}
                onChange={e => set('department', e.target.value)}
                disabled={saving}
              >
                <option value={ALL_DEPARTMENTS_ID}>{t('hub.warzone.allDepartments')}</option>
                {DEPARTMENTS.map(d => (
                  <option key={d.id} value={d.id}>{deptText(d, t, 'label')}</option>
                ))}
              </select>
            </label>
          </div>

          {isTask && (
            <>
              <div className="appdev-field-row">
                <label className="appdev-field">
                  <span>{t('hub.warzone.taskPanel.subtype')}</span>
                  <input
                    list="warzone-subtype-options"
                    value={draft.subtype || ''}
                    onChange={e => set('subtype', e.target.value)}
                    disabled={saving}
                    placeholder={t('hub.warzone.taskPanel.subtypePlaceholder')}
                  />
                  <datalist id="warzone-subtype-options">
                    {subtypeOptions.map(opt => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </label>
                <label className="appdev-field">
                  <span>{t('hub.warzone.taskPanel.priority')}</span>
                  <select
                    value={draft.priority || 'none'}
                    onChange={e => set('priority', e.target.value)}
                    disabled={saving}
                  >
                    {TASK_PRIORITIES.map(p => (
                      <option key={p} value={p}>{t(PRIORITY_KEYS[p] || p)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="appdev-field-row">
                <label className="appdev-field">
                  <span>{t('hub.warzone.taskPanel.status')}</span>
                  <select
                    value={draft.status || 'todo'}
                    onChange={e => set('status', e.target.value)}
                    disabled={saving}
                  >
                    {TASK_STATUSES.filter(s => s !== 'archived').map(s => (
                      <option key={s} value={s}>{t(STATUS_KEYS[s] || s)}</option>
                    ))}
                  </select>
                </label>
                <label className="appdev-field">
                  <span>{t('hub.warzone.taskPanel.visibility')}</span>
                  <select
                    value={draft.visibility || 'team'}
                    onChange={e => set('visibility', e.target.value)}
                    disabled={saving}
                  >
                    {VISIBILITY.map(v => (
                      <option key={v} value={v}>{t(VISIBILITY_KEYS[v] || v)}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          {isMilestone && (
            <div className="appdev-field-row">
              <label className="appdev-field">
                <span>{t('hub.warzone.taskPanel.eventStart')}</span>
                <DatePicker
                  value={draft.planned_for}
                  onChange={v => set('planned_for', v)}
                  disabled={saving}
                  locale={locale}
                  placeholder={t('hub.warzone.taskPanel.pickDate')}
                />
              </label>
              <label className="appdev-field">
                <span>{t('hub.warzone.taskPanel.eventEnd')}</span>
                <DatePicker
                  value={draft.deadline}
                  onChange={v => set('deadline', v)}
                  disabled={saving}
                  locale={locale}
                  placeholder={t('hub.warzone.taskPanel.pickDate')}
                />
              </label>
            </div>
          )}

          {isMilestone && (
            <p className="appdev-field-hint">{t('hub.warzone.taskPanel.eventHint')}</p>
          )}

          {isTask && (
            <div className="appdev-field">
              <span>{t('hub.warzone.taskPanel.deadline')}</span>
              <DatePicker
                value={draft.deadline}
                onChange={v => set('deadline', v)}
                disabled={saving}
                locale={locale}
                placeholder={t('hub.warzone.taskPanel.pickDate')}
              />
              <span className="appdev-field-hint">{t('hub.warzone.taskPanel.dueDateHint')}</span>
            </div>
          )}

          {isTask && (
            <label className="appdev-field">
              <span>{t('hub.warzone.taskPanel.assignee')}</span>
              <input
                value={draft.assignee || ''}
                onChange={e => set('assignee', e.target.value)}
                disabled={saving}
                placeholder={t('hub.warzone.taskPanel.assigneePlaceholder')}
              />
            </label>
          )}

          <div className="appdev-field">
            <span>{t('hub.warzone.taskPanel.link')}</span>
            <input
              value={draft.link_url || ''}
              onChange={e => set('link_url', e.target.value)}
              disabled={saving}
              placeholder={t('hub.warzone.taskPanel.linkPlaceholder')}
            />
          </div>
        </div>

        <footer className="appdev-panel-foot">
          {onDelete && draft.id && !isNew ? (
            <button type="button" className="appdev-btn-danger" onClick={() => onDelete(draft.id)} disabled={saving}>
              {t('hub.warzone.taskPanel.delete')}
            </button>
          ) : (
            <span />
          )}
          <div className="appdev-panel-foot-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              {t('hub.warzone.taskPanel.cancel')}
            </button>
            <button
              type="button"
              className="appdev-btn-primary"
              onClick={() => onSave(prepareSave(draft))}
              disabled={saving || !canSave}
            >
              {saving ? t('hub.warzone.taskPanel.saving') : isNew ? t('hub.warzone.taskPanel.create') : t('hub.warzone.taskPanel.save')}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
