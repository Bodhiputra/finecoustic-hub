'use client';

import { useLocale } from '@/components/LocaleProvider';
import { CALENDAR_KIND_FILTERS, DEPARTMENTS, deptText } from '@/lib/warzone';

const TYPE_META = {
  tasks: { labelKey: 'hub.warzone.legendTask', chipClass: 'is-task' },
  milestones: { labelKey: 'hub.warzone.legendMilestone', chipClass: 'is-milestone' },
};

export default function WarzoneScheduleFilters({
  activeFilters,
  onToggleType,
  kinds = CALENDAR_KIND_FILTERS,
  activeDepartments = null,
  onToggleDepartment = null,
  showDepartments = false,
}) {
  const { t } = useLocale();

  return (
    <div className="warzone-cal-filters warzone-schedule-filters" aria-label={t('hub.warzone.scheduleFilters')}>
      <div className="warzone-schedule-filter-group">
        <span className="warzone-cal-filters-label">{t('hub.warzone.scheduleFilterTypes')}</span>
        <div className="warzone-cal-filters-row" role="group" aria-label={t('hub.warzone.scheduleFilterTypes')}>
          {kinds.map(id => {
            const meta = TYPE_META[id];
            if (!meta) return null;
            const active = activeFilters.has(id);
            return (
              <button
                key={id}
                type="button"
                className={`warzone-cal-filter ${meta.chipClass}${active ? ' is-active' : ''}`}
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
        <div className="warzone-schedule-filter-group">
          <span className="warzone-cal-filters-label">{t('hub.warzone.departments')}</span>
          <div className="warzone-cal-filters-row" role="group" aria-label={t('hub.warzone.departments')}>
            {DEPARTMENTS.map(dept => {
              const active = activeDepartments.has(dept.id);
              return (
                <button
                  key={dept.id}
                  type="button"
                  className={`warzone-cal-filter is-dept${active ? ' is-active' : ''}`}
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
