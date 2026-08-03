'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  normalizeStatusColumn,
  statusColumnLabel,
} from '@/lib/internal-campaigns';

function columnsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function BoardStatusEditor({ board, tasks = [], onSaved, onClose }) {
  const { t } = useLocale();
  const { toast, toastStack } = useToast();
  const [columns, setColumns] = useState(() => board?.status_columns || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setColumns(board?.status_columns || []);
    setError('');
  }, [board]);

  const taskCounts = useMemo(() => {
    const counts = new Map();
    for (const task of tasks) {
      const id = String(task.status || '');
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }, [tasks]);

  const dirty = !columnsEqual(columns, board?.status_columns || []);

  function updateLabel(index, label) {
    setColumns(prev => prev.map((col, i) => (i === index ? { ...col, label } : col)));
  }

  function moveColumn(index, dir) {
    setColumns(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  function addColumn() {
    const base = `status_${Date.now()}`;
    setColumns(prev => [...prev, normalizeStatusColumn({ id: base, label: '' })]);
    setError('');
  }

  function removeColumn(index) {
    const col = columns[index];
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
        body: JSON.stringify({ status_columns: columns }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error || t('hub.internal.statusColumnSaveFailed');
        setError(msg);
        toast.error(msg);
        return;
      }
      const body = await res.json();
      const data = unwrapData(body);
      if (data?.board) onSaved?.(data.board);
      toast.success(t('hub.internal.statusColumnsSaved'));
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  if (!board) return null;

  return (
    <section className="internal-status-editor" aria-label={t('hub.internal.editStatusColumns')}>
      <header className="internal-status-editor-head">
        <div>
          <h3>{t('hub.internal.editStatusColumns')}</h3>
          <p>{t('hub.internal.editStatusColumnsDesc')}</p>
        </div>
        <button type="button" className="appdev-panel-close" onClick={onClose} aria-label={t('hub.internal.close')}>
          <Icon name="x" size={18} />
        </button>
      </header>

      <ul className="internal-status-editor-list">
        {columns.map((col, index) => (
          <li key={col.id} className="internal-status-editor-row">
            <div className="internal-status-editor-order">
              <button
                type="button"
                className="appdev-btn-ghost internal-status-editor-move"
                onClick={() => moveColumn(index, -1)}
                disabled={index === 0 || saving}
                aria-label={t('hub.internal.moveColumnUp')}
              >
                ↑
              </button>
              <button
                type="button"
                className="appdev-btn-ghost internal-status-editor-move"
                onClick={() => moveColumn(index, 1)}
                disabled={index === columns.length - 1 || saving}
                aria-label={t('hub.internal.moveColumnDown')}
              >
                ↓
              </button>
            </div>
            <label className="internal-status-editor-field">
              <span className="internal-status-editor-id">{col.id}</span>
              <input
                type="text"
                value={col.label}
                onChange={e => updateLabel(index, e.target.value)}
                disabled={saving}
                maxLength={60}
              />
            </label>
            <span className="internal-status-editor-count">
              {taskCounts.get(col.id) || 0}
            </span>
            <button
              type="button"
              className="appdev-btn-ghost is-danger"
              onClick={() => removeColumn(index)}
              disabled={saving}
              aria-label={t('hub.internal.removeStatusColumn')}
            >
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
        <div className="internal-status-editor-save">
          {error ? <p className="internal-status-editor-error">{error}</p> : null}
          <button type="button" className="appdev-btn-ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="button" className="appdev-btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? t('hub.internal.saving') : t('hub.internal.saveStatusColumns')}
          </button>
        </div>
      </div>

      <p className="internal-status-editor-hint">
        {columns.map(col => statusColumnLabel(col, t)).join(' → ')}
      </p>
      {toastStack}
    </section>
  );
}
