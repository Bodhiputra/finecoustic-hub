'use client';

import InternalTaskCard from '@/components/internal/InternalTaskCard';
import { useLocale } from '@/components/LocaleProvider';
import { sortTasksByFlowOrder, statusColumnLabel } from '@/lib/internal-campaigns';
import { taskOriginSummary } from '@/lib/task-origin-url';
import { useMemo } from 'react';

export default function InternalListView({
  tasks,
  onTaskClick,
  flowData = null,
  statusColumns = null,
  showTaskOrigin = false,
}) {
  const { t } = useLocale();

  function statusLabel(statusId) {
    const col = statusColumns?.find(c => (typeof c === 'string' ? c : c.id) === statusId);
    if (col) return statusColumnLabel(col, t);
    return statusColumnLabel({ id: statusId }, t);
  }

  const items = useMemo(
    () => (flowData ? sortTasksByFlowOrder(tasks, flowData) : tasks),
    [tasks, flowData]
  );

  if (items.length === 0) {
    return <p className="internal-empty">{t('hub.internal.noTasks')}</p>;
  }

  return (
    <section className="internal-list-view">
      <ul className="internal-list-view-ul">
        {items.map(task => (
          <li key={task.id} className="internal-list-view-row">
            <span className={`internal-list-view-kind${task.kind === 'milestone' ? ' is-milestone' : ''}`}>
              {task.kind === 'milestone' ? '◇' : '□'}
            </span>
            <span className={`internal-list-view-status is-${task.status}`}>
              {statusLabel(task.status)}
            </span>
            <div className="internal-list-view-main">
              <InternalTaskCard
                task={task}
                onClick={() => onTaskClick(task)}
                className="internal-task-card--list"
              />
              {showTaskOrigin ? (
                <span className="internal-list-view-origin">{taskOriginSummary(task, t)}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
