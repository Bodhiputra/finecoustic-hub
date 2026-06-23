'use client';

import { ISSUE_TYPES } from '@/lib/appdev';

export default function BoardFilters({
  assigneeFilter,
  onAssigneeFilterChange,
  typeFilter,
  onTypeFilterChange,
  assigneeOptions = [],
  t,
}) {
  return (
    <div className="appdev-filters">
      <label className="appdev-filter">
        <select
          className="appdev-filter-select"
          value={assigneeFilter}
          onChange={e => onAssigneeFilterChange(e.target.value)}
          aria-label={t('appdev.board.filterAssignee')}
        >
          <option value="">{t('appdev.board.filterAssigneeAll')}</option>
          <option value="__me__">{t('appdev.board.filterAssigneeMe')}</option>
          {assigneeOptions.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="appdev-filter">
        <select
          className="appdev-filter-select"
          value={typeFilter}
          onChange={e => onTypeFilterChange(e.target.value)}
          aria-label={t('appdev.board.filterType')}
        >
          <option value="">{t('appdev.board.filterTypeAll')}</option>
          {ISSUE_TYPES.map(type => (
            <option key={type} value={type}>
              {t(`appdev.type.${type}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
