/** Optional HH:MM times paired with YYYY-MM-DD date fields on tasks/meetings. */

export function normalizeTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatTaskTimeLabel(time, locale = 'en') {
  const normalized = normalizeTime(time);
  if (!normalized) return '';
  const [hours, minutes] = normalized.split(':').map(Number);
  const d = new Date(2000, 0, 1, hours, minutes);
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: locale !== 'zh',
    }).format(d);
  } catch {
    return normalized;
  }
}

export function formatTaskDateLabel(date, locale = 'en') {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

/** Date chip / list label — includes time when set. */
export function formatTaskScheduleLabel(date, time, locale = 'en') {
  if (!date) return '';
  const dateLabel = formatTaskDateLabel(date, locale);
  const timeLabel = formatTaskTimeLabel(time, locale);
  return timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel;
}

/** Meeting / milestone range for cards and calendar detail. */
export function formatTaskScheduleRange(task, locale = 'en') {
  if (!task) return '';
  const startDate = task.planned_for || task.deadline;
  const endDate = task.deadline || task.planned_for;
  if (!startDate && !endDate) return '';

  const startLabel = formatTaskScheduleLabel(startDate, task.planned_for_time, locale);
  const endLabel = formatTaskScheduleLabel(endDate, task.deadline_time, locale);

  if (!endDate || startDate === endDate) {
    if (task.planned_for_time && task.deadline_time && task.planned_for_time !== task.deadline_time) {
      return `${startLabel} – ${formatTaskTimeLabel(task.deadline_time, locale)}`;
    }
    return startLabel;
  }
  return `${startLabel} → ${endLabel}`;
}
