'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { formatIssueDate } from '@/lib/appdev';
import { TASK_STATUSES } from '@/lib/internal';
import { sortTasksByFlowOrder, statusColumnLabel } from '@/lib/internal-campaigns';
import { formatTaskScheduleLabel, formatTaskScheduleRange } from '@/lib/task-datetime';

const MILESTONE_STATUS_KEYS = {
  todo: 'hub.internal.taskPanel.milestoneScheduled',
  done: 'hub.internal.taskPanel.milestoneCompleted',
  cancelled: 'hub.internal.taskPanel.milestoneCancelled',
};

const KIND_KEYS = {
  task: 'hub.internal.taskPanel.task',
  milestone: 'hub.internal.taskPanel.milestone',
  meeting: 'hub.internal.taskPanel.meeting',
};

function sortTasksForTable(tasks) {
  return [...tasks].sort((a, b) => {
    const aDue = a.deadline || a.planned_for || '';
    const bDue = b.deadline || b.planned_for || '';
    if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
  });
}

function statusOptionsForTask(task, statusColumns) {
  if (statusColumns?.length) {
    return statusColumns.map(col => (typeof col === 'string' ? col : col.id)).filter(Boolean);
  }
  if (task.kind === 'milestone' || task.kind === 'meeting') {
    return ['todo', 'done', 'cancelled'];
  }
  return TASK_STATUSES;
}

function statusLabelForTask(task, statusColumns, t) {
  if ((task.kind === 'milestone' || task.kind === 'meeting') && MILESTONE_STATUS_KEYS[task.status]) {
    return t(MILESTONE_STATUS_KEYS[task.status]);
  }
  const col = statusColumns?.find(c => (typeof c === 'string' ? c : c.id) === task.status);
  if (col) return statusColumnLabel(col, t);
  return statusColumnLabel({ id: task.status }, t);
}

function dueLabelForTask(task, locale) {
  if (task.kind === 'milestone' || task.kind === 'meeting') {
    return formatTaskScheduleRange(task, locale);
  }
  return formatTaskScheduleLabel(task.deadline, task.deadline_time, locale);
}

function typeLabelForTask(task, t) {
  if (task.subtype) return task.subtype;
  const key = KIND_KEYS[task.kind] || KIND_KEYS.task;
  return t(key);
}

export default function InternalTableView({
  tasks,
  onTaskClick,
  onStatusChange,
  flowData = null,
  statusColumns = null,
  saving = false,
}) {
  const { t, locale } = useLocale();

  const items = useMemo(() => {
    const base = flowData ? sortTasksByFlowOrder(tasks, flowData) : sortTasksForTable(tasks);
    return base;
  }, [tasks, flowData]);

  const openRow = task => {
    if (saving) return;
    onTaskClick?.(task);
  };

  return (
    <div className="internal-table-wrap">
      <div className="internal-table-scroll h-scroll h-scroll--bleed">
        <table className="data-table internal-table">
          <thead>
            <tr>
              <th>{t('hub.internal.taskPanel.title')}</th>
              <th>{t('hub.internal.taskPanel.subtype')}</th>
              <th>{t('hub.internal.taskPanel.status')}</th>
              <th>{t('hub.internal.table.createdBy')}</th>
              <th>{t('hub.internal.taskPanel.assignee')}</th>
              <th>{t('hub.internal.table.createdAt')}</th>
              <th>{t('hub.internal.taskPanel.deadline')}</th>
              <th>{t('hub.internal.table.completedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="internal-table-empty">
                  {t('hub.internal.table.empty')}
                </td>
              </tr>
            )}
            {items.map(task => {
              const statusOptions = statusOptionsForTask(task, statusColumns);
              const canEditStatus = Boolean(onStatusChange) && statusOptions.length > 0;

              return (
                <tr
                  key={task.id}
                  className="internal-table-row"
                  onClick={() => openRow(task)}
                >
                  <td>
                    <span className="internal-table-title">{task.title || '—'}</span>
                  </td>
                  <td>
                    <span className="internal-table-text">{typeLabelForTask(task, t)}</span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {canEditStatus ? (
                      <select
                        className="internal-table-select"
                        value={task.status}
                        disabled={saving}
                        onChange={e => onStatusChange(task, e.target.value)}
                        aria-label={`${t('hub.internal.taskPanel.status')} — ${task.title}`}
                      >
                        {statusOptions.map(statusId => (
                          <option key={statusId} value={statusId}>
                            {statusLabelForTask({ ...task, status: statusId }, statusColumns, t)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="internal-table-text">
                        {statusLabelForTask(task, statusColumns, t)}
                      </span>
                    )}
                  </td>
                  <td>{task.created_by || '—'}</td>
                  <td>{task.assignee || task.owner || '—'}</td>
                  <td className="internal-table-date">{formatIssueDate(task.created_at, locale)}</td>
                  <td className="internal-table-date">{dueLabelForTask(task, locale) || '—'}</td>
                  <td className="internal-table-date">{formatIssueDate(task.completed_at, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
