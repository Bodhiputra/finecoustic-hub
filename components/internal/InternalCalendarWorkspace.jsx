'use client';

import { useMemo, useState } from 'react';
import InternalCalendar from '@/components/internal/InternalCalendar';
import InternalUnscheduledRail from '@/components/internal/InternalUnscheduledRail';
import HolidayCalendarControls from '@/components/internal/HolidayCalendarControls';
import { useLocale } from '@/components/LocaleProvider';
import {
  buildCalendarMap,
  isOverdueCalendarItem,
  isUnscheduledCalendarItem,
  todayKey,
} from '@/lib/internal';

export default function InternalCalendarWorkspace({
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
    e.dataTransfer.setData('application/x-internal-task-id', task.id);
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
    tasks: { className: 'is-task', labelKey: 'hub.internal.legendTask' },
    milestones: { className: 'is-milestone', labelKey: 'hub.internal.legendMilestone' },
    meetings: { className: 'is-meeting', labelKey: 'hub.internal.legendMeeting' },
    events: { className: 'is-event', labelKey: 'hub.internal.legendEvent' },
  };

  return (
    <div
      className={[
        'internal-cal-workspace',
        compact && 'is-compact',
        draggingId && 'is-dragging',
        railVisible && 'has-rail',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragEnd={handleDragEnd}
    >
      <div className="internal-cal-workspace-main">
        {showToolbar && (
          <div className="internal-cal-toolbar">
            <div className="internal-cal-legend" aria-label={t('hub.internal.typeLegend')}>
              {legendItems.map(id => {
                const meta = LEGEND_META[id];
                if (!meta) return null;
                return (
                  <span key={id} className={`internal-cal-legend-item ${meta.className}`}>
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

        <InternalCalendar
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
        <InternalUnscheduledRail
          unscheduled={unscheduled}
          overdue={overdue}
          onTaskClick={onTaskClick}
          onDragStart={handleDragStart}
        />
      )}
    </div>
  );
}
