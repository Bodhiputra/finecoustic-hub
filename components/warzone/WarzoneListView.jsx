'use client';

import WarzoneTaskCard from '@/components/warzone/WarzoneTaskCard';
import { useLocale } from '@/components/LocaleProvider';

const STATUS_KEYS = {
  todo: 'hub.warzone.statusTodo',
  in_progress: 'hub.warzone.statusInProgress',
  in_review: 'hub.warzone.statusInReview',
  done: 'hub.warzone.statusDone',
  cancelled: 'hub.warzone.statusCancelled',
};

export default function WarzoneListView({ tasks, onTaskClick }) {
  const { t } = useLocale();

  if (tasks.length === 0) {
    return <p className="warzone-empty">{t('hub.warzone.noTasks')}</p>;
  }

  return (
    <section className="warzone-list-view">
      <ul className="warzone-list-view-ul">
        {tasks.map(task => (
          <li key={task.id} className="warzone-list-view-row">
            <span className={`warzone-list-view-status is-${task.status}`}>
              {t(STATUS_KEYS[task.status] || 'hub.warzone.statusTodo')}
            </span>
            <WarzoneTaskCard
              task={task}
              onClick={() => onTaskClick(task)}
              className="warzone-task-card--list"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
