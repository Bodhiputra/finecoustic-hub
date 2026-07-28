'use client';

import { useMemo, useState } from 'react';
import UserAvatar from '@/components/internal/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';

const TABS = ['unscheduled', 'overdue'];

function KindBadge({ kind, t }) {
  const label =
    kind === 'event'
      ? t('hub.internal.legendEvent')
      : kind === 'milestone'
        ? t('hub.internal.legendMilestone')
        : t('hub.internal.legendTask');
  return <span className={`internal-rail-kind is-${kind || 'task'}`}>{label}</span>;
}

function RailItem({ task, onTaskClick, onDragStart }) {
  const { t } = useLocale();
  return (
    <li>
      <button
        type="button"
        className="internal-rail-item"
        draggable
        onDragStart={e => onDragStart(e, task)}
        onClick={() => onTaskClick(task)}
        title={task.title}
      >
        <span className={`internal-rail-item-glyph is-${task.kind || 'task'}`} aria-hidden="true" />
        <span className="internal-rail-item-body">
          <span className="internal-rail-item-title">{task.title}</span>
          <span className="internal-rail-item-meta">
            <KindBadge kind={task.kind} t={t} />
          </span>
        </span>
        <UserAvatar name={task.assignee || task.created_by} size={24} />
      </button>
    </li>
  );
}

export default function InternalUnscheduledRail({
  unscheduled = [],
  overdue = [],
  onTaskClick,
  onDragStart,
}) {
  const { t } = useLocale();
  const [tab, setTab] = useState('unscheduled');

  const items = tab === 'overdue' ? overdue : unscheduled;
  const counts = useMemo(
    () => ({ unscheduled: unscheduled.length, overdue: overdue.length }),
    [unscheduled.length, overdue.length]
  );

  return (
    <aside className="internal-cal-rail" aria-label={t('hub.internal.unscheduledRail')}>
      <div className="internal-cal-rail-tabs" role="tablist">
        {TABS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`internal-cal-rail-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {id === 'unscheduled' ? t('hub.internal.unscheduledRail') : t('hub.internal.overdueRail')}
            <span className="internal-cal-rail-count">{counts[id]}</span>
          </button>
        ))}
      </div>
      <p className="internal-cal-rail-hint">{t('hub.internal.railHint')}</p>
      {items.length === 0 ? (
        <p className="internal-cal-rail-empty">{t('hub.internal.railEmpty')}</p>
      ) : (
        <ul className="internal-cal-rail-list">
          {items.map(task => (
            <RailItem key={task.id} task={task} onTaskClick={onTaskClick} onDragStart={onDragStart} />
          ))}
        </ul>
      )}
    </aside>
  );
}
