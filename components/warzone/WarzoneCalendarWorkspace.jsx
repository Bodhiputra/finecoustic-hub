'use client';

import { useMemo, useState } from 'react';
import WarzoneCalendar from '@/components/warzone/WarzoneCalendar';
import WarzoneUnscheduledRail from '@/components/warzone/WarzoneUnscheduledRail';
import HolidayCalendarControls from '@/components/warzone/HolidayCalendarControls';
import { useLocale } from '@/components/LocaleProvider';
import {
  buildCalendarMap,
  isOverdueCalendarItem,
  isUnscheduledCalendarItem,
  todayKey,
} from '@/lib/warzone';

export default function WarzoneCalendarWorkspace({
  tasks = [],
  cursor,
  onCursorChange,
  focusDay,
  onFocusDay,
  onDayClick,
  onTaskClick,
  onScheduleTask,
  calendarItemFilter = () => true,
  holidaysByDate = {},
  showHolidays = false,
  onToggleShowHolidays,
  countries = [],
  onToggleCountry,
  showHolidayControls = true,
  showToolbar = true,
  showRail = true,
  legendKinds = null,
  compact = false,
}) {
  const { t } = useLocale();
  const [draggingId, setDraggingId] = useState(null);

  const today = useMemo(() => todayKey(), []);

  const calendarItems = useMemo(
    () => tasks.filter(task => !isUnscheduledCalendarItem(task) && calendarItemFilter(task)),
    [tasks, calendarItemFilter]
  );

  const tasksByDate = useMemo(() => buildCalendarMap(calendarItems), [calendarItems]);

  const unscheduled = useMemo(
    () =>
      tasks
        .filter(isUnscheduledCalendarItem)
        .sort((a, b) => String(a.title).localeCompare(String(b.title))),
    [tasks]
  );

  const overdue = useMemo(
    () =>
      tasks
        .filter(task => isOverdueCalendarItem(task, today))
        .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))),
    [tasks, today]
  );

  function handleDragStart(e, task) {
    setDraggingId(task.id);
    e.dataTransfer.setData('application/x-warzone-task-id', task.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  async function handleScheduleDrop(taskId, iso) {
    const task = tasks.find(item => item.id === taskId);
    if (!task || !onScheduleTask) return;
    await onScheduleTask(task, iso);
    setDraggingId(null);
  }

  const railVisible = showRail && (unscheduled.length > 0 || overdue.length > 0);

  const legendItems = legendKinds || ['tasks', 'events', 'milestones'];
  const LEGEND_META = {
    tasks: { className: 'is-task', labelKey: 'hub.warzone.legendTask' },
    milestones: { className: 'is-milestone', labelKey: 'hub.warzone.legendMilestone' },
    events: { className: 'is-event', labelKey: 'hub.warzone.legendEvent' },
  };

  return (
    <div
      className={[
        'warzone-cal-workspace',
        compact && 'is-compact',
        draggingId && 'is-dragging',
        railVisible && 'has-rail',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragEnd={handleDragEnd}
    >
      <div className="warzone-cal-workspace-main">
        {showToolbar && (
          <div className="warzone-cal-toolbar">
            <div className="warzone-cal-legend" aria-label={t('hub.warzone.typeLegend')}>
              {legendItems.map(id => {
                const meta = LEGEND_META[id];
                if (!meta) return null;
                return (
                  <span key={id} className={`warzone-cal-legend-item ${meta.className}`}>
                    {t(meta.labelKey)}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {showHolidayControls && (
          <HolidayCalendarControls
            showHolidays={showHolidays}
            onToggleShow={onToggleShowHolidays}
            countries={countries}
            onToggleCountry={onToggleCountry}
          />
        )}

        <WarzoneCalendar
          tasksByDate={tasksByDate}
          holidaysByDate={holidaysByDate}
          showHolidays={showHolidays}
          cursor={cursor}
          onCursorChange={onCursorChange}
          onDayClick={onDayClick}
          onTaskClick={onTaskClick}
          focusDay={focusDay}
          onFocusDay={onFocusDay}
          onScheduleDrop={handleScheduleDrop}
          draggingTaskId={draggingId}
          compact={compact}
        />
      </div>

      {railVisible && (
        <WarzoneUnscheduledRail
          unscheduled={unscheduled}
          overdue={overdue}
          onTaskClick={onTaskClick}
          onDragStart={handleDragStart}
        />
      )}
    </div>
  );
}
