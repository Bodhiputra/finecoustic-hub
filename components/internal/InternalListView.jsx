'use client';

import InternalTaskCard from '@/components/internal/InternalTaskCard';
import { useLocale } from '@/components/LocaleProvider';

const STATUS_KEYS = {
  todo: 'hub.internal.statusTodo',
  in_progress: 'hub.internal.statusInProgress',
  in_review: 'hub.internal.statusInReview',
  done: 'hub.internal.statusDone',
  cancelled: 'hub.internal.statusCancelled',
};

export default function InternalListView({ tasks, onTaskClick }) {
  const { t } = useLocale();

  if (tasks.length === 0) {
    return <p className="internal-empty">{t('hub.internal.noTasks')}</p>;
  }

  return (
    <section className="internal-list-view">
      <ul className="internal-list-view-ul">
        {tasks.map(task => (
          <li key={task.id} className="internal-list-view-row">
            <span className={`internal-list-view-status is-${task.status}`}>
              {t(STATUS_KEYS[task.status] || 'hub.internal.statusTodo')}
            </span>
            <InternalTaskCard
              task={task}
              onClick={() => onTaskClick(task)}
              className="internal-task-card--list"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
