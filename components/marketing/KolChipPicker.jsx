'use client';

/** Single-select chip row — used for KOL tags, tiers, and similar small enums. */
export default function KolChipPicker({
  options = [],
  value,
  onChange,
  disabled = false,
  ariaLabel = '',
  className = '',
}) {
  return (
    <div
      className={`kol-chip-picker${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map(option => {
        const active = value === option.id;
        return (
          <button
            key={option.id || '__unset__'}
            type="button"
            role="radio"
            aria-checked={active}
            className={`kol-chip-picker-option${active ? ' is-active' : ''}${option.tone ? ` is-${option.tone}` : ''}`}
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
