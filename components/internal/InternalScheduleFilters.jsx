'use client';

import { useLocale } from '@/components/LocaleProvider';
import { CALENDAR_KIND_FILTERS, DEPARTMENTS, deptText } from '@/lib/internal';

const TYPE_META = {
  tasks: { labelKey: 'hub.internal.legendTask', chipClass: 'is-task' },
  milestones: { labelKey: 'hub.internal.legendMilestone', chipClass: 'is-milestone' },
};

export default function InternalScheduleFilters({
  activeFilters,
  onToggleType,
  kinds = CALENDAR_KIND_FILTERS,
  activeDepartments = null,
  onToggleDepartment = null,
  showDepartments = false,
}) {
  const { t } = useLocale();

  return (
    <div className="internal-cal-filters internal-schedule-filters" aria-label={t('hub.internal.scheduleFilters')}>
      <div className="internal-schedule-filter-group">
        <span className="internal-cal-filters-label">{t('hub.internal.scheduleFilterTypes')}</span>
        <div className="internal-cal-filters-row" role="group" aria-label={t('hub.internal.scheduleFilterTypes')}>
          {kinds.map(id => {
            const meta = TYPE_META[id];
            if (!meta) return null;
            const active = activeFilters.has(id);
            return (
              <button
                key={id}
                type="button"
                className={`internal-cal-filter ${meta.chipClass}${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => onToggleType(id)}
              >
                {t(meta.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {showDepartments && activeDepartments && onToggleDepartment && (
        <div className="internal-schedule-filter-group">
          <span className="internal-cal-filters-label">{t('hub.internal.departments')}</span>
          <div className="internal-cal-filters-row" role="group" aria-label={t('hub.internal.departments')}>
            {DEPARTMENTS.map(dept => {
              const active = activeDepartments.has(dept.id);
              return (
                <button
                  key={dept.id}
                  type="button"
                  className={`internal-cal-filter is-dept${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => onToggleDepartment(dept.id)}
                >
                  {deptText(dept, t, 'label')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
