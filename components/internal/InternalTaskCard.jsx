'use client';

import Icon from '@/components/Icon';
import UserAvatar from '@/components/internal/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { isMilestonePast, isTaskOverdue, milestoneEndDate, taskDueDate } from '@/lib/internal';
import { getTaskAssignees } from '@/lib/task-assignees';
import { formatTaskScheduleLabel, formatTaskScheduleRange } from '@/lib/task-datetime';

const PRIORITY_KEYS = {
  urgent: 'hub.internal.priorityUrgent',
  high: 'hub.internal.priorityHigh',
  medium: 'hub.internal.priorityMedium',
  low: 'hub.internal.priorityLow',
};

function HintChip({ className = '', title, children }) {
  return (
    <span className={['internal-hint-chip', className].filter(Boolean).join(' ')} title={title}>
      {children}
    </span>
  );
}

export default function InternalTaskCard({
  task,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
  className = '',
}) {
  const { t, locale } = useLocale();
  const isMilestone = task.kind === 'milestone';
  const isMeeting = task.kind === 'meeting';
  const dueLabel = isMilestone || isMeeting
    ? formatTaskScheduleRange(task, locale)
    : formatTaskScheduleLabel(task.deadline || taskDueDate(task), task.deadline_time, locale);
  const due = dueLabel || null;
  const overdue = isTaskOverdue(task);
  const pastMilestone = task.kind === 'milestone' && isMilestonePast(task);
  const assignees = getTaskAssignees(task);
  const fallbackPerson = task.owner || task.created_by;
  const hasAssignees = assignees.length > 0;
  const subtaskTotal = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter(s => s.done).length || 0;
  const priority = task.priority && task.priority !== 'none' ? task.priority : null;
  const isDaily = task.recurrence === 'daily';
  const hasChips = priority || task.subtype || isDaily || due || subtaskTotal > 0 || hasAssignees || fallbackPerson;

  return (
    <button
      type="button"
      className={[
        'internal-task-card',
        isMilestone && 'is-milestone',
        overdue && 'is-overdue',
        pastMilestone && 'is-past',
        isDragging && 'is-dragging',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <span className="internal-task-card-head">
        {isMilestone ? (
          <span className="internal-task-card-kind" aria-hidden="true">◇</span>
        ) : null}
        <span className="internal-task-card-title">{task.title}</span>
      </span>

      {hasChips && (
        <div className="internal-task-card-chips">
          {priority && (
            <HintChip className={`is-priority is-${priority}`} title={t(PRIORITY_KEYS[priority])}>
              {t(PRIORITY_KEYS[priority])}
            </HintChip>
          )}
          {task.subtype && (
            <HintChip className="is-subtype" title={task.subtype}>
              {task.subtype}
            </HintChip>
          )}
          {isDaily && (
            <HintChip className="is-recurrence" title={t('hub.internal.recurrenceDaily')}>
              {t('hub.internal.recurrenceDaily')}
            </HintChip>
          )}
          {due && (
            <HintChip
              className={`is-date${overdue ? ' is-overdue' : ''}${pastMilestone ? ' is-past' : ''}`}
              title={isMilestone ? t('hub.internal.taskPanel.eventEnd') : t('hub.internal.taskPanel.deadline')}
            >
              <Icon name="calendar" size={10} />
              {due}
            </HintChip>
          )}
          {subtaskTotal > 0 && (
            <HintChip className="is-subtasks" title={t('hub.internal.taskPanel.subtasks')}>
              <Icon name="checkSquare" size={10} />
              {subtaskDone}/{subtaskTotal}
            </HintChip>
          )}
          {hasAssignees ? (
            <HintChip
              className="is-assignee"
              title={assignees.join(', ')}
            >
              <UserAvatar name={assignees[0]} size={16} />
              <span className="internal-hint-chip-label">
                {assignees.length === 1 ? assignees[0] : `${assignees[0]} +${assignees.length - 1}`}
              </span>
            </HintChip>
          ) : fallbackPerson ? (
            <HintChip className="is-assignee" title={fallbackPerson}>
              <UserAvatar name={fallbackPerson} size={16} />
              <span className="internal-hint-chip-label">{fallbackPerson}</span>
            </HintChip>
          ) : null}
        </div>
      )}
    </button>
  );
}
