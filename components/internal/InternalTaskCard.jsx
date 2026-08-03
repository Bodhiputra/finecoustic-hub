'use client';

import Icon from '@/components/Icon';
import UserAvatar from '@/components/internal/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { isTaskOverdue, taskDueDate } from '@/lib/internal';

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
  const { t } = useLocale();
  const due = taskDueDate(task);
  const overdue = isTaskOverdue(task);
  const assignee = task.assignee || task.owner || task.created_by;
  const subtaskTotal = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter(s => s.done).length || 0;
  const priority = task.priority && task.priority !== 'none' ? task.priority : null;
  const isMilestone = task.kind === 'milestone';
  const hasChips = priority || task.subtype || due || subtaskTotal > 0 || assignee;

  return (
    <button
      type="button"
      className={[
        'internal-task-card',
        isMilestone && 'is-milestone',
        overdue && 'is-overdue',
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
          {due && (
            <HintChip
              className={`is-date${overdue ? ' is-overdue' : ''}`}
              title={t('hub.internal.taskPanel.deadline')}
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
          {assignee && (
            <HintChip className="is-assignee" title={assignee}>
              <UserAvatar name={assignee} size={16} />
              <span className="internal-hint-chip-label">{assignee}</span>
            </HintChip>
          )}
        </div>
      )}
    </button>
  );
}
