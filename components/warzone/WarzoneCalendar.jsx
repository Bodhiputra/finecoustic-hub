'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { holidayLabel } from '@/lib/holidays';

const MAX_VISIBLE_DEFAULT = 5;
const MAX_VISIBLE_COMPACT = 3;

function toIso(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ iso: toIso(py, pm, day), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: toIso(year, month, day), inMonth: true });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ iso: toIso(ny, nm, nextDay), inMonth: false });
    nextDay += 1;
  }

  return cells;
}

function eventRange(task) {
  if (task?.kind !== 'event') return null;
  const a = task.planned_for || task.deadline;
  const b = task.deadline || task.planned_for;
  if (!a || !b) return null;
  const start = a <= b ? a : b;
  const end = b >= a ? b : a;
  return { start, end, isSpan: start !== end };
}

function isMultiDayEvent(task) {
  const range = eventRange(task);
  return Boolean(range?.isSpan);
}

function sortDayTasks(tasks) {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  return [...tasks].sort((a, b) => {
    if (a.kind === 'milestone' && b.kind !== 'milestone') return -1;
    if (b.kind === 'milestone' && a.kind !== 'milestone') return 1;
    const pa = priorityOrder[a.priority] ?? 4;
    const pb = priorityOrder[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title);
  });
}

function collectSpanEvents(tasksByDate) {
  const seen = new Set();
  const events = [];
  for (const list of Object.values(tasksByDate)) {
    for (const item of list) {
      const range = eventRange(item);
      if (!range?.isSpan || seen.has(item.id)) continue;
      seen.add(item.id);
      events.push({ item, ...range });
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.item.title.localeCompare(b.item.title));
}

function weekSegments(week, spanEvents) {
  const weekStart = week[0].iso;
  const weekEnd = week[6].iso;
  const segments = [];

  for (const ev of spanEvents) {
    if (ev.end < weekStart || ev.start > weekEnd) continue;
    const segStart = ev.start > weekStart ? ev.start : weekStart;
    const segEnd = ev.end < weekEnd ? ev.end : weekEnd;
    const startCol = week.findIndex(c => c.iso === segStart);
    const endCol = week.findIndex(c => c.iso === segEnd);
    if (startCol < 0 || endCol < 0) continue;
    segments.push({
      event: ev.item,
      startCol: startCol + 1,
      endCol: endCol + 2,
      isStart: segStart === ev.start,
      isEnd: segEnd === ev.end,
    });
  }

  const sorted = [...segments].sort(
    (a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol)
  );
  const lanes = [];

  for (const seg of sorted) {
    let lane = 0;
    while (true) {
      const blocked = (lanes[lane] || []).some(
        existing => !(seg.endCol <= existing.startCol || seg.startCol >= existing.endCol)
      );
      if (!blocked) {
        if (!lanes[lane]) lanes[lane] = [];
        lanes[lane].push(seg);
        seg.lane = lane;
        break;
      }
      lane += 1;
    }
  }

  return { segments: sorted, laneCount: lanes.length };
}

function CalendarEvent({ task, onSelect }) {
  const kind = task.kind || 'task';
  return (
    <button
      type="button"
      className={`warzone-cal-event is-kind-${kind} is-${task.status}${kind === 'milestone' ? ' is-milestone' : ''}${kind === 'event' ? ' is-event' : ''}`}
      onClick={e => {
        e.stopPropagation();
        onSelect(task);
      }}
      title={task.title}
    >
      <span className={`warzone-cal-kind-glyph is-${kind}`} aria-hidden="true" />
      <span className="warzone-cal-event-title">{task.title}</span>
    </button>
  );
}

function SpanEventBar({ segment, weekKey, onSelect }) {
  const { event, startCol, endCol, isStart, isEnd, lane } = segment;
  return (
    <button
      type="button"
      className={[
        'warzone-cal-span',
        'is-event',
        isStart && 'is-range-start',
        isEnd && 'is-range-end',
        !isStart && 'is-continued',
        !isEnd && 'is-continuing',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ gridColumn: `${startCol} / ${endCol}`, gridRow: lane + 1 }}
      onClick={e => {
        e.stopPropagation();
        onSelect(event);
      }}
      title={event.title}
    >
      {isStart && <span className="warzone-cal-span-title">{event.title}</span>}
    </button>
  );
}

function HolidayChip({ holiday, locale }) {
  return (
    <span
      className={`warzone-cal-holiday is-${holiday.countryCode.toLowerCase()}`}
      title={`${holiday.countryCode} · ${holiday.name}`}
    >
      {holidayLabel(holiday, locale)}
    </span>
  );
}

function formatDayLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function WarzoneCalendar({
  tasksByDate,
  cursor,
  onCursorChange,
  onDayClick,
  onTaskClick,
  focusDay,
  onFocusDay,
  holidaysByDate = {},
  showHolidays = false,
  compact = false,
  onScheduleDrop,
  draggingTaskId = null,
}) {
  const { t, locale } = useLocale();

  const dowLabels = useMemo(() => {
    const raw = t('hub.warzone.dow');
    return Array.isArray(raw) ? raw : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }, [t]);

  const todayIso = useMemo(() => {
    const n = new Date();
    return toIso(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const weeks = useMemo(() => {
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);

  const spanEvents = useMemo(() => collectSpanEvents(tasksByDate), [tasksByDate]);
  const weekLayouts = useMemo(
    () => weeks.map(week => ({ week, ...weekSegments(week, spanEvents) })),
    [weeks, spanEvents]
  );

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(locale === 'zh' ? 'zh-CN' : undefined, {
    month: 'long',
    year: 'numeric',
  });

  const focusTasks = focusDay ? sortDayTasks(tasksByDate[focusDay] || []) : [];
  const focusHolidays = focusDay && showHolidays ? (holidaysByDate[focusDay] || []) : [];
  const maxVisible = compact ? MAX_VISIBLE_COMPACT : MAX_VISIBLE_DEFAULT;

  function prevMonth() {
    onCursorChange(c => {
      const m = c.month - 1;
      return m < 0 ? { year: c.year - 1, month: 11 } : { ...c, month: m };
    });
  }

  function nextMonth() {
    onCursorChange(c => {
      const m = c.month + 1;
      return m > 11 ? { year: c.year + 1, month: 0 } : { ...c, month: m };
    });
  }

  function handleCellClick(iso, itemCount) {
    if (itemCount > 0) onFocusDay(prev => (prev === iso ? null : iso));
    else onDayClick(iso);
  }

  function handleDrop(iso, e) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('application/x-warzone-task-id');
    if (id && onScheduleDrop) onScheduleDrop(id, iso);
  }

  function handleDragOver(e) {
    if (!onScheduleDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  return (
    <section className={`warzone-calendar${compact ? ' is-compact' : ''}`}>
      <header className="warzone-cal-header">
        <div className="warzone-cal-nav">
          <button type="button" className="warzone-cal-nav-btn" onClick={prevMonth} aria-label={t('hub.warzone.prevMonth')}>
            ‹
          </button>
          <h2 className="warzone-cal-title">{monthLabel}</h2>
          <button type="button" className="warzone-cal-nav-btn" onClick={nextMonth} aria-label={t('hub.warzone.nextMonth')}>
            ›
          </button>
        </div>
      </header>

      <div className="warzone-cal-month" role="grid" aria-label={monthLabel}>
        <div className="warzone-cal-dow-row" role="row">
          {dowLabels.map((d, i) => (
            <div key={`dow-${i}`} className="warzone-cal-dow" role="columnheader">
              {d}
            </div>
          ))}
        </div>

        {weekLayouts.map(({ week, segments, laneCount }) => (
          <div
            key={week[0].iso}
            className={['warzone-cal-week', laneCount > 0 && 'has-spans'].filter(Boolean).join(' ')}
            style={laneCount > 0 ? { '--cal-week-span-rows': laneCount } : undefined}
            role="row"
          >
            <div className="warzone-cal-week-days">
              {week.map(cell => {
                const { iso, inMonth } = cell;
                const dayNum = Number(iso.slice(-2));
                const allDayItems = tasksByDate[iso] || [];
                const dayTasks = sortDayTasks(allDayItems.filter(task => !isMultiDayEvent(task)));
                const dayHolidays = showHolidays ? (holidaysByDate[iso] || []) : [];
                const isToday = iso === todayIso;
                const isFocused = iso === focusDay;
                const dayOfWeek = new Date(`${iso}T12:00:00`).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const visibleHolidays = dayHolidays.slice(0, 2);
                const holidayOverflow = dayHolidays.length - visibleHolidays.length;
                const taskSlots = Math.max(1, maxVisible - visibleHolidays.length);
                const visible = dayTasks.slice(0, taskSlots);
                const overflow = dayTasks.length - visible.length + holidayOverflow;
                const itemCount = allDayItems.length + dayHolidays.length;
                const hasOverdue = allDayItems.some(
                  task => task.kind === 'task' && task.deadline && task.deadline < todayIso && task.status !== 'done' && task.status !== 'archived'
                );

                return (
                  <div
                    key={iso}
                    role="gridcell"
                    className={[
                      'warzone-cal-cell',
                      !inMonth && 'is-outside',
                      isToday && 'is-today',
                      isWeekend && inMonth && 'is-weekend',
                      hasOverdue && 'has-overdue',
                      isFocused && 'is-focused',
                      draggingTaskId && inMonth && 'is-drop-target',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleCellClick(iso, itemCount)}
                    onDragOver={handleDragOver}
                    onDrop={e => handleDrop(iso, e)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCellClick(iso, itemCount);
                      }
                    }}
                    tabIndex={0}
                  >
                    <span className={`warzone-cal-day-num${isToday ? ' is-today' : ''}`}>{dayNum}</span>
                    <div className="warzone-cal-events">
                      {visibleHolidays.map(h => (
                        <HolidayChip key={h.id} holiday={h} locale={locale} />
                      ))}
                      {visible.map(task => (
                        <CalendarEvent key={`${task.id}-${iso}`} task={task} onSelect={onTaskClick} />
                      ))}
                      {overflow > 0 && (
                        <button
                          type="button"
                          className="warzone-cal-more"
                          onClick={e => {
                            e.stopPropagation();
                            onFocusDay(iso);
                          }}
                        >
                          +{overflow} {t('hub.warzone.more')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {laneCount > 0 && (
              <div
                className="warzone-cal-week-spans"
                style={{ gridTemplateRows: `repeat(${laneCount}, var(--cal-span-h, 24px))` }}
                aria-hidden="true"
              >
                {segments.map(seg => (
                  <SpanEventBar
                    key={`${seg.event.id}-${week[0].iso}-${seg.lane}`}
                    segment={seg}
                    weekKey={week[0].iso}
                    onSelect={onTaskClick}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {focusDay && (
        <div className="warzone-cal-day-panel">
          <header className="warzone-cal-day-panel-head">
            <div>
              <h3>{formatDayLabel(focusDay)}</h3>
              <p>
                {focusHolidays.length > 0 && showHolidays
                  ? `${focusHolidays.length + focusTasks.length === 1 ? t('hub.warzone.itemCountOne') : t('hub.warzone.itemCount').replace('{count}', String(focusHolidays.length + focusTasks.length))}${focusHolidays.length ? ` · ${focusHolidays.length} ${t('hub.warzone.holidayCount')}` : ''}`
                  : focusTasks.length === 1
                    ? t('hub.warzone.taskCountOne')
                    : t('hub.warzone.taskCount').replace('{count}', String(focusTasks.length))}
              </p>
            </div>
            <button type="button" className="warzone-cal-nav-btn" onClick={() => onFocusDay(null)} aria-label={t('hub.warzone.close')}>
              ×
            </button>
          </header>
          {focusHolidays.length > 0 && (
            <ul className="warzone-cal-holiday-list">
              {focusHolidays.map(h => (
                <li key={h.id} className="warzone-cal-holiday-row">
                  <HolidayChip holiday={h} locale={locale} />
                  <span className="warzone-cal-holiday-meta">{h.countryCode}</span>
                </li>
              ))}
            </ul>
          )}
          {focusTasks.length === 0 && focusHolidays.length === 0 ? (
            <p className="warzone-empty">{t('hub.warzone.noTasks')}</p>
          ) : focusTasks.length > 0 ? (
            <ul className="warzone-cal-day-list">
              {focusTasks.map(task => (
                <li key={task.id}>
                  <button type="button" className="warzone-cal-day-row" onClick={() => onTaskClick(task)}>
                    <span className={`warzone-cal-kind-glyph is-${task.kind || 'task'}`} aria-hidden="true" />
                    <span className="warzone-cal-day-row-title">{task.title}</span>
                    {task.kind === 'event' || task.kind === 'milestone' ? (
                      <span className="warzone-status-pill is-milestone">{t('hub.warzone.kindMilestone')}</span>
                    ) : (
                      <span className={`warzone-status-pill is-${task.status}`}>
                        {t(`hub.warzone.status${task.status === 'todo' ? 'Todo' : task.status === 'in_progress' ? 'InProgress' : task.status === 'done' ? 'Done' : ''}`) || task.status}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
