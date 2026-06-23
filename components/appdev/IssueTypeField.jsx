'use client';

import { useEffect, useId, useState } from 'react';
import { issueTypeForInput, issueTypeFromInput, formatIssueTypeLabel } from '@/lib/appdev';
import { useLocale } from '@/components/LocaleProvider';

export default function IssueTypeField({
  value,
  onChange,
  disabled = false,
  className = '',
  inputClassName = '',
  id,
}) {
  const { t } = useLocale();
  const fieldId = useId();
  const inputId = id || fieldId;
  const [text, setText] = useState(() => issueTypeForInput(value, t));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(issueTypeForInput(value, t));
    }
  }, [value, t, focused]);

  const commit = raw => {
    const next = raw.trim() ? issueTypeFromInput(raw, t) : '';
    onChange(next);
    setText(issueTypeForInput(next, t));
  };

  return (
    <input
      id={inputId}
      type="text"
      className={`appdev-type-input ${inputClassName || className}`.trim()}
      value={text}
      onChange={e => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit(text);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      placeholder={t('appdev.board.typePlaceholder')}
      disabled={disabled}
      maxLength={48}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

export function IssueTypeLabel({ type }) {
  const { t } = useLocale();
  return formatIssueTypeLabel(type, t);
}
