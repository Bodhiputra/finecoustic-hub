'use client';

import DatePicker from '@/components/appdev/DatePicker';
import { normalizeTime } from '@/lib/task-datetime';

/** Date + optional time — time clears when date is cleared. */
export default function TaskDateTimeField({
  dateLabel,
  timeLabel,
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  disabled = false,
  locale = 'en',
  datePlaceholder = 'Pick a date',
  timePlaceholder = 'Time',
}) {
  const hasDate = Boolean(dateValue);

  function handleDateChange(nextDate) {
    onDateChange?.(nextDate);
    if (!nextDate) onTimeChange?.(null);
  }

  function handleTimeChange(raw) {
    onTimeChange?.(raw ? normalizeTime(raw) : null);
  }

  return (
    <div className="task-datetime-field">
      <label className="appdev-field">
        <span>{dateLabel}</span>
        <DatePicker
          value={dateValue}
          onChange={handleDateChange}
          disabled={disabled}
          locale={locale}
          placeholder={datePlaceholder}
        />
      </label>
      <label className="appdev-field task-datetime-time">
        <span>{timeLabel}</span>
        <input
          type="time"
          className="appdev-prompt-input task-datetime-time-input"
          value={timeValue || ''}
          onChange={e => handleTimeChange(e.target.value)}
          disabled={disabled || !hasDate}
          placeholder={timePlaceholder}
          aria-label={timeLabel}
        />
      </label>
    </div>
  );
}
