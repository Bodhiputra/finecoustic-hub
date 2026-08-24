'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import HubModal from '@/components/HubModal';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import BoardCustomFieldsManager from '@/components/internal/BoardCustomFieldsManager';
import {
  columnEditLabel,
  normalizeStatusColumn,
  statusColumnLabel,
} from '@/lib/internal-campaigns';
import { isWorkflowLockedColumnId } from '@/lib/task-workflow';
import { normalizeBoardProperties } from '@/lib/board-properties';

function columnsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function propertiesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function columnsForEditing(rawColumns, t) {
  return (rawColumns || []).map(col => ({
    ...col,
    label: columnEditLabel(col, t),
  }));
}

const BOARD_SAVE_ERROR_KEYS = {
  status_columns_required: 'hub.internal.statusColumnMinOne',
  status_columns_limit: 'hub.internal.statusColumnLimit',
};

function boardSaveErrorMessage(code, t) {
  const key = BOARD_SAVE_ERROR_KEYS[code];
  return key ? t(key) : t('hub.internal.statusColumnSaveFailed');
}

export default function BoardStatusEditor({ board, tasks = [], onSaved, onClose }) {
  const { t } = useLocale();
  const { toast, toastStack } = useToast();
  const [columns, setColumns] = useState(() => columnsForEditing(board?.status_columns, t));
  const [customProperties, setCustomProperties] = useState(
    () => normalizeBoardProperties(board?.custom_properties || [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  useEffect(() => {
    setColumns(columnsForEditing(board?.status_columns, t));
    setCustomProperties(normalizeBoardProperties(board?.custom_properties || []));
    setError('');
  }, [board, t]);

  const taskCounts = useMemo(() => {
    const counts = new Map();
    for (const task of tasks) {
      const id = String(task.status || '');
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }, [tasks]);

  const dirty =
    !columnsEqual(columns, columnsForEditing(board?.status_columns, t))
    || !propertiesEqual(customProperties, normalizeBoardProperties(board?.custom_properties || []));

  function updateLabel(index, label) {
    setColumns(prev => prev.map((col, i) => (i === index ? { ...col, label } : col)));
  }

  function moveColumnTo(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setColumns(prev => {
      const next = [...prev];
      if (fromIndex >= next.length || toIndex >= next.length) return prev;
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }

  function handleDragStart(index) {
    if (saving) return;
    setDragIndex(index);
    setDropIndex(index);
  }

  function handleDragOver(index, e) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDropIndex(index);
  }

  function handleDrop(index) {
    if (dragIndex === null) return;
    moveColumnTo(dragIndex, index);
    setDragIndex(null);
    setDropIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDropIndex(null);
  }

  function addColumn() {
    setColumns(prev => [...prev, normalizeStatusColumn({ id: `status_${Date.now()}`, label: '' })]);
    setError('');
  }

  function removeColumn(index) {
    const col = columns[index];
    if (isWorkflowLockedColumnId(col.id)) {
      const msg = t('hub.internal.statusColumnLocked');
      setError(msg);
      toast.error(msg);
      return;
    }
    const count = taskCounts.get(col.id) || 0;
    if (count > 0) {
      const msg = t('hub.internal.statusColumnHasTasks').replace('{count}', String(count));
      setError(msg);
      toast.error(msg);
      return;
    }
    if (columns.length <= 1) {
      const msg = t('hub.internal.statusColumnMinOne');
      setError(msg);
      toast.error(msg);
      return;
    }
    setError('');
    setColumns(prev => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(API_V1.internalBoard(board.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          status_columns: columns,
          custom_properties: customProperties,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = boardSaveErrorMessage(body?.error, t);
        setError(msg);
        toast.error(msg);
        return;
      }
      const body = await res.json();
      const data = unwrapData(body);
      if (data?.board) onSaved?.(data.board);
      toast.success(t('hub.internal.boardFieldsSaved'));
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  if (!board) return null;

  return (
    <HubModal
      open
      onClose={onClose}
      className="internal-board-fields-modal internal-status-editor"
      labelledBy="board-fields-title"
      disableBackdropClose={saving}
    >
          <header className="internal-status-editor-head">
            <div>
              <h3 id="board-fields-title">{t('hub.internal.editBoardFields')}</h3>
              <p>{t('hub.internal.editBoardFieldsDesc')}</p>
            </div>
            <button type="button" className="hub-icon-btn appdev-panel-close" onClick={onClose} aria-label={t('hub.internal.close')}>
              <Icon name="x" size={18} />
            </button>
          </header>

          <h4 className="internal-status-editor-subhead">{t('hub.internal.statusColumnsHeading')}</h4>
          <p className="internal-status-editor-hint">{t('hub.internal.reorderColumnHint')}</p>
          <ul className="internal-status-editor-list">
            {columns.map((col, index) => (
              <li
                key={col.id}
                className={`internal-status-editor-row${dragIndex === index ? ' is-dragging' : ''}${dropIndex === index && dragIndex !== null && dragIndex !== index ? ' is-drop-target' : ''}`}
                draggable={!saving}
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(index, e)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
              >
                <span className="internal-status-editor-grip" aria-hidden="true">
                  <Icon name="gripVertical" size={16} />
                </span>
                <label className="internal-status-editor-field">
                  <input
                    type="text"
                    value={col.label}
                    onChange={e => updateLabel(index, e.target.value)}
                    disabled={saving}
                    maxLength={60}
                    placeholder={statusColumnLabel(col, t)}
                    aria-label={statusColumnLabel(col, t)}
                  />
                </label>
                <span className="internal-status-editor-count">
                  {taskCounts.get(col.id) || 0}
                </span>
                <button type="button" className="hub-icon-btn is-danger" onClick={() => removeColumn(index)} disabled={saving} aria-label={t('hub.internal.removeStatusColumn')}>
                  <Icon name="x" size={14} />
                </button>
              </li>
            ))}
          </ul>

          <div className="internal-status-editor-actions">
            <button type="button" className="appdev-btn-ghost" onClick={addColumn} disabled={saving || columns.length >= 12}>
              <Icon name="plus" size={14} />
              {t('hub.internal.addStatusColumn')}
            </button>
          </div>

          <p className="internal-status-editor-hint internal-status-editor-preview">
            {columns.map(col => col.label || statusColumnLabel(col, t)).join(' → ')}
          </p>

          <BoardCustomFieldsManager
            embedded
            properties={customProperties}
            onPropertiesChange={setCustomProperties}
            disabled={saving}
          />

          <footer className="internal-status-editor-save internal-board-fields-footer">
            {error ? <p className="internal-status-editor-error">{error}</p> : null}
            <button type="button" className="appdev-btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
            <button type="button" className="appdev-btn-primary" onClick={save} disabled={saving || !dirty}>
              {saving ? t('hub.internal.saving') : t('hub.internal.saveBoardFields')}
            </button>
          </footer>
          {toastStack}
    </HubModal>
  );
}
