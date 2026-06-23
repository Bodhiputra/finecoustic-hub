'use client';

import { useId } from 'react';
import { ISSUE_TYPES, formatIssueTypeLabel, issueTypeForInput, issueTypeFromInput } from '@/lib/appdev';
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
  const listId = useId();
  const fieldId = id || listId;

  return (
    <>
      <input
        id={fieldId}
        type="text"
        className={inputClassName || className}
        list={listId}
        value={issueTypeForInput(value, t)}
        onChange={e => {
          const raw = e.target.value;
          if (!raw.trim()) {
            onChange('');
            return;
          }
          onChange(issueTypeFromInput(raw, t));
        }}
        placeholder={t('appdev.board.typePlaceholder')}
        disabled={disabled}
        maxLength={48}
        autoComplete="off"
      />
      <datalist id={listId}>
        {ISSUE_TYPES.map(type => (
          <option key={type} value={formatIssueTypeLabel(type, t)} />
        ))}
      </datalist>
    </>
  );
}

export function IssueTypeLabel({ type }) {
  const { t } = useLocale();
  return formatIssueTypeLabel(type, t);
}
