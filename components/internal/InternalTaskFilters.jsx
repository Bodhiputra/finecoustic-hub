'use client';

import Link from 'next/link';
import UserAvatar from '@/components/internal/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { personKey } from '@/lib/appdev';
import { togglePeopleKey, internalTasksUrl } from '@/lib/internal';

const FILTER_IDS = ['in_progress', 'overdue'];

export default function InternalTaskFilters({
  deptBase,
  activeView = '',
  taskView = 'board',
  defaultView = '',
  activePeople = new Set(),
  activeSubtype = '',
  people = [],
  subtypes = [],
  currentUserName = '',
  getTaskUrl = null,
  peopleOnly = false,
  hidePeople = false,
}) {
  const { t } = useLocale();
  const meKey = currentUserName ? personKey(currentUserName) : '';
  const meActive = Boolean(meKey && activePeople.size === 1 && activePeople.has(meKey));
  const unfilteredView = defaultView || taskView;

  const filters = [
    { id: 'in_progress', label: t('hub.internal.inProgress') },
    { id: 'overdue', label: t('hub.internal.overdue') },
  ];

  const bucketActive = FILTER_IDS.includes(activeView);
  const peopleActive = activePeople.size > 0;
  const subtypeActive = Boolean(activeSubtype);
  const currentView = bucketActive ? activeView : taskView;

  function hrefFor({ view, peopleKeys = activePeople, subtype = activeSubtype }) {
    if (getTaskUrl) return getTaskUrl({ view, people: peopleKeys, subtype });
    return internalTasksUrl(deptBase, { view, people: peopleKeys, subtype });
  }

  function personHref(key) {
    return hrefFor({ view: currentView, peopleKeys: togglePeopleKey(activePeople, key) });
  }

  function subtypeHref(id) {
    const next = activeSubtype === id ? '' : id;
    return hrefFor({ view: currentView, subtype: next });
  }

  function bucketHref(id) {
    const nextView = activeView === id ? unfilteredView : id;
    return hrefFor({ view: nextView });
  }

  const showClear = peopleOnly
    ? (peopleActive && !hidePeople) || subtypeActive
    : bucketActive || (peopleActive && !hidePeople) || subtypeActive;

  return (
    <div className="internal-task-filters">
      {!peopleOnly && (
      <div className="internal-task-filters-group">
        <span className="internal-task-filters-label">{t('hub.internal.filters')}</span>
        <div className="internal-task-filters-row h-scroll h-scroll--bleed" role="toolbar" aria-label={t('hub.internal.filters')}>
          {filters.map(({ id, label }) => (
            <Link
              key={id}
              href={bucketHref(id)}
              className={`internal-task-filter${activeView === id ? ' is-active' : ''}`}
              aria-pressed={activeView === id}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      )}

      {subtypes.length > 0 ? (
        <div className="internal-task-filters-group">
          <span className="internal-task-filters-label">{t('hub.internal.filterSubtype')}</span>
          <div className="internal-task-filters-row h-scroll h-scroll--bleed" role="toolbar" aria-label={t('hub.internal.filterSubtype')}>
            {subtypes.map(({ id, label }) => (
              <Link
                key={id}
                href={subtypeHref(id)}
                className={`internal-task-filter internal-task-filter-subtype${activeSubtype === id ? ' is-active' : ''}`}
                aria-pressed={activeSubtype === id}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!hidePeople && (meKey || people.length > 0) && (
        <div className="internal-task-filters-group">
          <span className="internal-task-filters-label">{t('hub.internal.filterPeople')}</span>
          <div className="internal-task-filters-row h-scroll h-scroll--bleed" role="toolbar" aria-label={t('hub.internal.filterPeople')}>
            {meKey ? (
              <Link
                href={hrefFor({
                  view: currentView,
                  peopleKeys: meActive ? new Set() : new Set([meKey]),
                })}
                className={`internal-task-filter internal-task-filter-person internal-task-filter-me${meActive ? ' is-active' : ''}`}
                aria-pressed={meActive}
              >
                <UserAvatar name={currentUserName} size={18} />
                <span>{t('hub.internal.filterMe')}</span>
              </Link>
            ) : null}
            {people
              .filter(({ key }) => key !== meKey)
              .map(({ key, name }) => (
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

      {showClear ? (
        <div className="internal-task-filters-clear">
          <Link href={hrefFor({ view: unfilteredView, peopleKeys: new Set(), subtype: '' })} className="internal-task-filter is-clear">
            {t('hub.internal.clearFilters')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
