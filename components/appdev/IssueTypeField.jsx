'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  formatIssueTypeLabel,
  issueTypeForInput,
  issueTypeFromInput,
  personKey,
} from '@/lib/appdev';
import { useLocale } from '@/components/LocaleProvider';

export default function IssueTypeField({
  value,
  onChange,
  taskTypes = [],
  onRegisterType,
  disabled = false,
  className = '',
  inputClassName = '',
  id,
}) {
  const { t } = useLocale();
  const listId = useId();
  const inputId = id || listId;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const displayValue = issueTypeForInput(value, t);

  useEffect(() => {
    if (!open) setQuery(displayValue);
  }, [displayValue, open]);

  useEffect(() => {
    const onDocClick = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const options = useMemo(
    () =>
      taskTypes.map(type => ({
        type,
        label: formatIssueTypeLabel(type, t),
      })),
    [taskTypes, t]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
    );
  }, [options, query]);

  const queryMatchesExisting = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return true;
    const resolved = issueTypeFromInput(trimmed, t);
    return taskTypes.some(type => personKey(type) === personKey(resolved));
  }, [query, taskTypes, t]);

  const applyType = (raw, registerIfNew = true) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      onChange('');
      setQuery('');
      return;
    }
    const normalized = issueTypeFromInput(trimmed, t);
    const isNew = !taskTypes.some(type => personKey(type) === personKey(normalized));
    if (isNew && registerIfNew && onRegisterType) {
      onRegisterType(normalized);
    }
    onChange(normalized);
    setQuery(formatIssueTypeLabel(normalized, t));
  };

  const pick = type => {
    applyType(formatIssueTypeLabel(type, t), false);
    setOpen(false);
  };

  const showList = open && !disabled;
  const showCreate =
    showList && query.trim() && !queryMatchesExisting;

  return (
    <div
      className={`appdev-people-picker appdev-type-picker ${inputClassName || className}`.trim()}
      ref={rootRef}
    >
      <input
        id={inputId}
        role="combobox"
        aria-expanded={showList && (filtered.length > 0 || showCreate)}
        aria-controls={listId}
        aria-autocomplete="list"
        type="text"
        className="appdev-type-input"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          const trimmed = e.target.value.trim();
          if (!trimmed) {
            onChange('');
            return;
          }
          onChange(issueTypeFromInput(trimmed, t));
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (rootRef.current?.contains(document.activeElement)) return;
            setOpen(false);
            if (query.trim()) {
              applyType(query);
            } else {
              setQuery(displayValue);
            }
          }, 120);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(displayValue);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && query.trim()) {
            e.preventDefault();
            applyType(query);
            setOpen(false);
          }
          if (e.key === 'Escape') {
            setOpen(false);
            setQuery(displayValue);
          }
        }}
        placeholder={t('appdev.board.typePlaceholder')}
        disabled={disabled}
        maxLength={48}
        autoComplete="off"
        spellCheck={false}
      />
      {showList && (filtered.length > 0 || showCreate) && (
        <ul id={listId} className="appdev-people-list" role="listbox">
          {filtered.map(item => (
            <li key={item.type}>
              <button
                type="button"
                role="option"
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(item.type)}
              >
                {item.label}
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                role="option"
                className="appdev-type-create"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  applyType(query);
                  setOpen(false);
                }}
              >
                {t('appdev.board.typeCreate').replace('{name}', query.trim())}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function IssueTypeLabel({ type }) {
  const { t } = useLocale();
  return formatIssueTypeLabel(type, t);
}
