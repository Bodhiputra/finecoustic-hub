'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { personKey } from '@/lib/appdev';
import { addWorker, normalizeWorkers, removeWorker } from '@/lib/appdev-workers';

function WorkerChip({ name, onRemove, removable }) {
  return (
    <span className="appdev-worker-chip">
      {name}
      {removable && onRemove && (
        <button
          type="button"
          className="appdev-worker-chip-remove"
          onClick={() => onRemove(name)}
          aria-label={`Remove ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export default function WorkersField({
  workers = [],
  onChange,
  people = [],
  currentUser = '',
  mode = 'owner',
  label,
  hint,
  placeholder,
  disabled = false,
  t,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const normalized = normalizeWorkers(workers);

  useEffect(() => {
    const onDocClick = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = people.filter(name => !normalized.some(w => personKey(w) === personKey(name)));
    if (!q) return pool;
    return pool.filter(name => name.toLowerCase().includes(q));
  }, [people, normalized, query]);

  const add = name => {
    if (!people.some(p => personKey(p) === personKey(name))) return;
    const next = addWorker(normalized, name);
    onChange(next);
    setQuery('');
    setOpen(false);
  };

  const remove = name => {
    onChange(removeWorker(normalized, name));
  };

  const joinAsMe = () => {
    if (!currentUser) return;
    add(currentUser);
  };

  const showList = open && mode === 'owner';
  const canPick = showList && filtered.length > 0;

  return (
    <div className="appdev-workers-field">
      <span className="appdev-field-label">{label}</span>
      {hint && <span className="appdev-field-hint">{hint}</span>}

      <div className="appdev-worker-chips">
        {normalized.length === 0 && (
          <span className="appdev-worker-empty">{t('appdev.board.noAssignees')}</span>
        )}
        {normalized.map(name => (
          <WorkerChip
            key={personKey(name)}
            name={name}
            removable={mode === 'owner' && !disabled}
            onRemove={remove}
          />
        ))}
      </div>

      {mode === 'owner' && !disabled && (
        <div className="appdev-people-picker appdev-workers-add" ref={rootRef}>
          <input
            role="combobox"
            aria-expanded={canPick}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && filtered.length) {
                e.preventDefault();
                add(filtered[0]);
              }
              if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            autoComplete="off"
            disabled={disabled}
          />
          {showList && (
            <ul id={listId} className="appdev-people-list" role="listbox">
              {canPick ? (
                filtered.map(name => (
                  <li key={name}>
                    <button
                      type="button"
                      role="option"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => add(name)}
                    >
                      {name}
                    </button>
                  </li>
                ))
              ) : (
                <li className="appdev-people-list-empty" role="presentation">
                  {t('appdev.board.assigneeNoMatches')}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {mode === 'contributor' && currentUser && !normalized.some(w => personKey(w) === personKey(currentUser)) && (
        <button type="button" className="appdev-assign-to-me" onClick={joinAsMe} disabled={disabled}>
          {t('appdev.board.assignToMe')}
        </button>
      )}
    </div>
  );
}
