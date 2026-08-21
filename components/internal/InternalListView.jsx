'use client';

import Icon from '@/components/Icon';
import InternalTableView from '@/components/internal/InternalTableView';
import { useLocale } from '@/components/LocaleProvider';
import {
  assignedInboxMetaLine,
  assignedInboxOpenLabel,
  sortAssignedInboxTasks,
} from '@/lib/assigned-inbox';
import { isTaskOverdue, todayKey } from '@/lib/internal';
import { sortTasksByFlowOrder } from '@/lib/internal-campaigns';
import { useMemo } from 'react';

export default function InternalListView({
  tasks,
  onTaskClick,
  onStatusChange,
  flowData = null,
  statusColumns = null,
  showTaskOrigin = false,
  saving = false,
}) {
  const { t, locale } = useLocale();

  const items = useMemo(() => {
    const base = flowData ? sortTasksByFlowOrder(tasks, flowData) : tasks;
    return showTaskOrigin ? sortAssignedInboxTasks(base) : base;
  }, [tasks, flowData, showTaskOrigin]);

  if (items.length === 0) {
    return <p className="internal-empty">{t('hub.internal.noTasks')}</p>;
  }

  if (showTaskOrigin) {
    const dayKey = todayKey();
    return (
      <section className="internal-list-view internal-inbox-list">
        <ul className="internal-inbox-list-ul">
          {items.map(task => {
            const overdue = isTaskOverdue(task, dayKey);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  className={`internal-inbox-row${overdue ? ' is-overdue' : ''}`}
                  onClick={() => onTaskClick(task)}
                >
                  <div className="internal-inbox-row-copy">
                    <span className="internal-inbox-row-title">{task.title || '—'}</span>
                    <span className="internal-inbox-row-meta">
                      {assignedInboxMetaLine(task, t, locale)}
                    </span>
                  </div>
                  <span className="internal-inbox-row-action">
                    <span>{assignedInboxOpenLabel(task, t)}</span>
                    <Icon name="chevronRight" size={14} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <InternalTableView
      tasks={items}
      onTaskClick={onTaskClick}
      onStatusChange={onStatusChange}
      flowData={flowData}
      statusColumns={statusColumns}
      saving={saving}
    />
  );
}
