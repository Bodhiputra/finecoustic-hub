'use client';

import { useRef } from 'react';
import { dateInputValueToIso, formatIssueDate, isoToDateInputValue } from '@/lib/appdev';
import Icon from '@/components/Icon';

export default function DatePicker({
  id,
  value,
  onChange,
  disabled = false,
  locale = 'en',
  placeholder = 'Pick a date',
  className = '',
}) {
  const inputRef = useRef(null);

  const openPicker = () => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        input.click();
      }
    } else {
      input.click();
    }
  };

  const display = value ? formatIssueDate(value, locale) : placeholder;

  return (
    <div
      className={`appdev-date-picker-wrap${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
    >
      <span
        className={`appdev-date-picker-display${value ? '' : ' is-placeholder'}`}
        aria-hidden="true"
      >
        {display}
      </span>
      <Icon name="calendar" size={16} className="appdev-date-picker-icon" aria-hidden />
      <input
        ref={inputRef}
        id={id}
        type="date"
        className="appdev-date-picker-input"
        value={isoToDateInputValue(value)}
        disabled={disabled}
        aria-label={placeholder}
        onChange={e => onChange(dateInputValueToIso(e.target.value))}
        onClick={e => {
          if (disabled) return;
          if (typeof e.currentTarget.showPicker === 'function') {
            try {
              e.currentTarget.showPicker();
            } catch {
              /* browser may already open picker */
            }
          }
        }}
      />
      <button
        type="button"
        className="appdev-date-picker-hit"
        disabled={disabled}
        aria-label={placeholder}
        onClick={openPicker}
      />
    </div>
  );
}
