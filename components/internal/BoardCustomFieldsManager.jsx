'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  BOARD_FIELD_TYPES,
  boardFieldTypeLabel,
  newBoardPropertyId,
  normalizeBoardProperty,
} from '@/lib/board-properties';

function propertiesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function BoardCustomFieldsManager({
  boardId,
  properties = [],
  onSaved,
  onPropertiesChange,
  embedded = false,
  disabled = false,
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [localDraft, setLocalDraft] = useState(properties);
  const [saving, setSaving] = useState(false);

  const draft = embedded ? properties : localDraft;
  const setDraft = embedded
    ? next => {
        const value = typeof next === 'function' ? next(properties) : next;
        onPropertiesChange?.(value);
      }
    : setLocalDraft;

  useEffect(() => {
    if (!embedded) setLocalDraft(properties);
  }, [properties, embedded]);

  const dirty = !embedded && !propertiesEqual(localDraft, properties);

  function addProperty(type = 'text') {
    setDraft(prev => [
      ...prev,
      normalizeBoardProperty({ id: newBoardPropertyId(), type, label: '' }),
    ]);
  }

  function updateProperty(index, patch) {
    setDraft(prev =>
      prev.map((prop, i) => (i === index ? normalizeBoardProperty({ ...prop, ...patch }) : prop))
    );
  }

  function removeProperty(index) {
    setDraft(prev => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!boardId || embedded) return;
    setSaving(true);
    try {
      const res = await fetch(API_V1.internalBoard(boardId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ custom_properties: localDraft }),
      });
      if (!res.ok) {
        toast.error(t('hub.internal.fieldSaveFailed'));
        return;
      }
      const body = await res.json();
      const data = unwrapData(body);
      if (data?.board) onSaved?.(data.board);
      toast.success(t('hub.internal.fieldsSaved'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`task-board-fields-manager${embedded ? ' is-embedded' : ''}`}>
      <h4 className="task-custom-fields-title">{t('hub.internal.customFieldsHeading')}</h4>
      <p className="appdev-field-hint">{t('hub.internal.customFieldsHint')}</p>
      {draft.length > 0 ? (
        <ul className="internal-status-editor-list internal-board-props-list">
          {draft.map((prop, index) => (
            <li key={prop.id} className="internal-status-editor-row">
              <select
                value={prop.type}
                onChange={e => updateProperty(index, { type: e.target.value })}
                disabled={disabled || saving}
                aria-label={t('hub.internal.fieldTypeLabel')}
              >
                {BOARD_FIELD_TYPES.map(type => (
                  <option key={type} value={type}>{boardFieldTypeLabel(type, t)}</option>
                ))}
              </select>
              <input
                type="text"
                value={prop.label}
                onChange={e => updateProperty(index, { label: e.target.value })}
                disabled={disabled || saving}
                placeholder={t('hub.internal.fieldLabelPlaceholder')}
                maxLength={80}
              />
              {prop.type === 'select' ? (
                <input
                  type="text"
                  value={(prop.options || []).join(', ')}
                  onChange={e =>
                    updateProperty(index, {
                      options: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                    })
                  }
                  disabled={disabled || saving}
                  placeholder={t('hub.internal.fieldOptionsPlaceholder')}
                />
              ) : null}
              <button
                type="button"
                className="hub-icon-btn is-danger"
                onClick={() => removeProperty(index)}
                disabled={disabled || saving}
                aria-label={t('hub.internal.removeCustomField')}
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="task-board-fields-manager-actions">
        <button
          type="button"
          className="appdev-btn-ghost"
          onClick={() => addProperty('text')}
          disabled={disabled || saving || draft.length >= 20}
        >
          <Icon name="plus" size={14} />
          {t('hub.internal.addCustomField')}
        </button>
        {!embedded && dirty ? (
          <button
            type="button"
            className="appdev-btn-primary"
            onClick={save}
            disabled={disabled || saving}
          >
            {saving ? t('hub.internal.saving') : t('hub.internal.saveBoardFields')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
