'use client';

import { useMemo, useState } from 'react';
import UserAvatar from '@/components/warzone/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';

const TABS = ['unscheduled', 'overdue'];

function KindBadge({ kind, t }) {
  const label =
    kind === 'event'
      ? t('hub.warzone.legendEvent')
      : kind === 'milestone'
        ? t('hub.warzone.legendMilestone')
        : t('hub.warzone.legendTask');
  return <span className={`warzone-rail-kind is-${kind || 'task'}`}>{label}</span>;
}

function RailItem({ task, onTaskClick, onDragStart }) {
  const { t } = useLocale();
  return (
    <li>
      <button
        type="button"
        className="warzone-rail-item"
        draggable
        onDragStart={e => onDragStart(e, task)}
        onClick={() => onTaskClick(task)}
        title={task.title}
      >
        <span className={`warzone-rail-item-glyph is-${task.kind || 'task'}`} aria-hidden="true" />
        <span className="warzone-rail-item-body">
          <span className="warzone-rail-item-title">{task.title}</span>
          <span className="warzone-rail-item-meta">
            <KindBadge kind={task.kind} t={t} />
          </span>
        </span>
        <UserAvatar name={task.assignee || task.created_by} size={24} />
      </button>
    </li>
  );
}

export default function WarzoneUnscheduledRail({
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
    <aside className="warzone-cal-rail" aria-label={t('hub.warzone.unscheduledRail')}>
      <div className="warzone-cal-rail-tabs" role="tablist">
        {TABS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`warzone-cal-rail-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {id === 'unscheduled' ? t('hub.warzone.unscheduledRail') : t('hub.warzone.overdueRail')}
            <span className="warzone-cal-rail-count">{counts[id]}</span>
          </button>
        ))}
      </div>
      <p className="warzone-cal-rail-hint">{t('hub.warzone.railHint')}</p>
      {items.length === 0 ? (
        <p className="warzone-cal-rail-empty">{t('hub.warzone.railEmpty')}</p>
      ) : (
        <ul className="warzone-cal-rail-list">
          {items.map(task => (
            <RailItem key={task.id} task={task} onTaskClick={onTaskClick} onDragStart={onDragStart} />
          ))}
        </ul>
      )}
    </aside>
  );
}
