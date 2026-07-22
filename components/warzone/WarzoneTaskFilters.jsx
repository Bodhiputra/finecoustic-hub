'use client';

import Link from 'next/link';
import UserAvatar from '@/components/warzone/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { togglePeopleKey, warzoneTasksUrl } from '@/lib/warzone';

const FILTER_IDS = ['bank', 'in_progress', 'today', 'overdue'];

export default function WarzoneTaskFilters({
  deptBase,
  activeView = '',
  taskView = 'board',
  activePeople = new Set(),
  people = [],
}) {
  const { t } = useLocale();

  const filters = [
    { id: 'bank', label: t('hub.warzone.todoBank') },
    { id: 'in_progress', label: t('hub.warzone.inProgress') },
    { id: 'today', label: t('hub.warzone.today') },
    { id: 'overdue', label: t('hub.warzone.overdue') },
  ];

  const bucketActive = FILTER_IDS.includes(activeView);
  const peopleActive = activePeople.size > 0;
  const currentView = bucketActive ? activeView : taskView;

  function hrefFor({ view, peopleKeys = activePeople }) {
    return warzoneTasksUrl(deptBase, { view, people: peopleKeys });
  }

  function personHref(key) {
    return hrefFor({ view: currentView, peopleKeys: togglePeopleKey(activePeople, key) });
  }

  return (
    <div className="warzone-task-filters">
      <div className="warzone-task-filters-group">
        <span className="warzone-task-filters-label">{t('hub.warzone.filters')}</span>
        <div className="warzone-task-filters-row" role="toolbar" aria-label={t('hub.warzone.filters')}>
          {filters.map(({ id, label }) => (
            <Link
              key={id}
              href={hrefFor({ view: id })}
              className={`warzone-task-filter${activeView === id ? ' is-active' : ''}`}
              aria-current={activeView === id ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {people.length > 0 && (
        <div className="warzone-task-filters-group">
          <span className="warzone-task-filters-label">{t('hub.warzone.filterPeople')}</span>
          <div className="warzone-task-filters-row" role="toolbar" aria-label={t('hub.warzone.filterPeople')}>
            {people.map(({ key, name }) => (
              <Link
                key={key}
                href={personHref(key)}
                className={`warzone-task-filter warzone-task-filter-person${activePeople.has(key) ? ' is-active' : ''}`}
                aria-pressed={activePeople.has(key)}
              >
                <UserAvatar name={name} size={18} />
                <span>{name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(bucketActive || peopleActive) && (
        <div className="warzone-task-filters-clear">
          <Link href={hrefFor({ view: taskView, peopleKeys: new Set() })} className="warzone-task-filter is-clear">
            {t('hub.warzone.clearFilters')}
          </Link>
        </div>
      )}
    </div>
  );
}
