'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { platformChipClass } from '@/lib/kol-pool';

function formatOptionLabel(option, hasCodeLabel) {
  const parts = [option.label];
  if (option.platform) parts.push(option.platform);
  let text = parts.join(' · ');
  if (option.hasCode && hasCodeLabel) text += ` (${hasCodeLabel})`;
  return text;
}

export default function KolPoolSearchSelect({
  options = [],
  value = '',
  onChange,
  label = '',
  placeholder = '',
  disabled = false,
}) {
  const { t } = useLocale();
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find(option => option.id === value) || null,
    [options, value]
  );

  const hasCodeLabel = t('hub.kolTracking.hasCode');
  const displayValue = selected ? formatOptionLabel(selected, hasCodeLabel) : '';

  useEffect(() => {
    if (!open) setQuery(displayValue);
  }, [displayValue, open]);

  useEffect(() => {
    const onDocClick = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(option =>
      [option.label, option.platform, option.id]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [options, query]);

  const pick = option => {
    onChange?.(option.id);
    setQuery(formatOptionLabel(option, hasCodeLabel));
    setOpen(false);
  };

  const clear = () => {
    onChange?.('');
    setQuery('');
    setOpen(true);
  };

  const showList = open && !disabled;

  return (
    <label className="kol-pool-combobox-field">
      {label ? <span className="kol-pool-combobox-label">{label}</span> : null}
      <div className="kol-pool-combobox" ref={rootRef}>
        <Icon name="search" size={16} className="kol-pool-combobox-icon" aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          aria-expanded={showList && filtered.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className="kol-pool-combobox-input"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value.trim()) onChange?.('');
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(selected ? '' : query);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setOpen(false);
              setQuery(displayValue);
            }
            if (event.key === 'Enter' && filtered[0]) {
              event.preventDefault();
              pick(filtered[0]);
            }
          }}
        />
        {value ? (
          <button
            type="button"
            className="kol-pool-combobox-clear"
            onClick={clear}
            disabled={disabled}
            aria-label={t('common.close')}
          >
            <Icon name="x" size={14} />
          </button>
        ) : null}
        {showList ? (
          <ul id={listId} className="kol-pool-combobox-list" role="listbox">
            {filtered.length === 0 ? (
              <li className="kol-pool-combobox-empty">{t('hub.kolTracking.noKolMatches')}</li>
            ) : (
              filtered.map(option => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    className={`kol-pool-combobox-option${option.id === value ? ' is-selected' : ''}`}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => pick(option)}
                  >
                    <span className="kol-pool-combobox-option-label">{option.label}</span>
                    {option.platform ? (
                      <span className={`kol-chip ${platformChipClass(option.platform)}`}>
                        {option.platform}
                      </span>
                    ) : null}
                    {option.hasCode ? (
                      <span className="kol-pool-combobox-tag">{hasCodeLabel}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </label>
  );
}
