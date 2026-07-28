'use client';

import Link from 'next/link';
import UserAvatar from '@/components/internal/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { togglePeopleKey, internalTasksUrl } from '@/lib/internal';

const FILTER_IDS = ['in_progress', 'today', 'overdue'];

export default function InternalTaskFilters({
  deptBase,
  activeView = '',
  taskView = 'board',
  activePeople = new Set(),
  people = [],
}) {
  const { t } = useLocale();

  const filters = [
    { id: 'in_progress', label: t('hub.internal.inProgress') },
    { id: 'today', label: t('hub.internal.today') },
    { id: 'overdue', label: t('hub.internal.overdue') },
  ];

  const bucketActive = FILTER_IDS.includes(activeView);
  const peopleActive = activePeople.size > 0;
  const currentView = bucketActive ? activeView : taskView;

  function hrefFor({ view, peopleKeys = activePeople }) {
    return internalTasksUrl(deptBase, { view, people: peopleKeys });
  }

  function personHref(key) {
    return hrefFor({ view: currentView, peopleKeys: togglePeopleKey(activePeople, key) });
  }

  return (
    <div className="internal-task-filters">
      <div className="internal-task-filters-group">
        <span className="internal-task-filters-label">{t('hub.internal.filters')}</span>
        <div className="internal-task-filters-row h-scroll h-scroll--bleed" role="toolbar" aria-label={t('hub.internal.filters')}>
          {filters.map(({ id, label }) => (
            <Link
              key={id}
              href={hrefFor({ view: id })}
              className={`internal-task-filter${activeView === id ? ' is-active' : ''}`}
              aria-current={activeView === id ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {people.length > 0 && (
        <div className="internal-task-filters-group">
          <span className="internal-task-filters-label">{t('hub.internal.filterPeople')}</span>
          <div className="internal-task-filters-row h-scroll h-scroll--bleed" role="toolbar" aria-label={t('hub.internal.filterPeople')}>
            {people.map(({ key, name }) => (
              <Link
                key={key}
                href={personHref(key)}
                className={`internal-task-filter internal-task-filter-person${activePeople.has(key) ? ' is-active' : ''}`}
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
        <div className="internal-task-filters-clear">
          <Link href={hrefFor({ view: taskView, peopleKeys: new Set() })} className="internal-task-filter is-clear">
            {t('hub.internal.clearFilters')}
          </Link>
        </div>
      )}
    </div>
  );
}
