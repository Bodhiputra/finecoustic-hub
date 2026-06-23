'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export default function PeoplePicker({
  value,
  onChange,
  people = [],
  label,
  hint,
  placeholder,
  id,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const rootRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(name => name.toLowerCase().includes(q));
  }, [people, query]);

  useEffect(() => {
    const onDocClick = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = name => {
    setQuery(name);
    onChange(name);
    setOpen(false);
  };

  const onInput = e => {
    const next = e.target.value;
    setQuery(next);
    onChange(next);
    setOpen(true);
  };

  const showList = open && filtered.length > 0;

  return (
    <label className="appdev-field">
      <span>{label}</span>
      <div className="appdev-people-picker" ref={rootRef}>
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={onInput}
          onFocus={() => !disabled && setOpen(true)}
          onClick={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
        />
        {showList && (
          <ul id={listId} className="appdev-people-list" role="listbox">
            {filtered.map(name => (
              <li key={name}>
                <button type="button" role="option" onMouseDown={e => e.preventDefault()} onClick={() => pick(name)}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <span className="appdev-field-hint">{hint}</span>}
    </label>
  );
}
