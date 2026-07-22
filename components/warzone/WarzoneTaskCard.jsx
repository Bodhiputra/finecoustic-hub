'use client';

import Icon from '@/components/Icon';
import UserAvatar from '@/components/warzone/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { isTaskOverdue, taskDueDate } from '@/lib/warzone';

const PRIORITY_KEYS = {
  urgent: 'hub.warzone.priorityUrgent',
  high: 'hub.warzone.priorityHigh',
  medium: 'hub.warzone.priorityMedium',
  low: 'hub.warzone.priorityLow',
};

function HintChip({ className = '', title, children }) {
  return (
    <span className={['warzone-hint-chip', className].filter(Boolean).join(' ')} title={title}>
      {children}
    </span>
  );
}

export default function WarzoneTaskCard({
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
  const hasChips = priority || task.subtype || due || subtaskTotal > 0 || assignee;

  return (
    <button
      type="button"
      className={[
        'warzone-task-card',
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
      <span className="warzone-task-card-title">{task.title}</span>

      {hasChips && (
        <div className="warzone-task-card-chips">
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
              title={t('hub.warzone.taskPanel.deadline')}
            >
              <Icon name="calendar" size={10} />
              {due}
            </HintChip>
          )}
          {subtaskTotal > 0 && (
            <HintChip className="is-subtasks" title={t('hub.warzone.taskPanel.subtasks')}>
              <Icon name="checkSquare" size={10} />
              {subtaskDone}/{subtaskTotal}
            </HintChip>
          )}
          {assignee && (
            <HintChip className="is-assignee" title={assignee}>
              <UserAvatar name={assignee} size={16} />
              <span className="warzone-hint-chip-label">{assignee}</span>
            </HintChip>
          )}
        </div>
      )}
    </button>
  );
}
