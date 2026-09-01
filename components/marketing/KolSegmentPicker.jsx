'use client';

/** Compact chip picker for small option sets (replaces dropdowns). */
export default function KolSegmentPicker({
  options = [],
  value,
  onChange,
  disabled = false,
  ariaLabel = '',
  className = '',
}) {
  return (
    <div
      className={`kol-segment-picker${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map(option => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`kol-segment-option${active ? ' is-active' : ''}`}
            onClick={() => onChange?.(option.id)}
            disabled={disabled}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
