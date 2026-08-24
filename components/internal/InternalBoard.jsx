'use client';

import { useMemo, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { BOARD_STATUSES } from '@/lib/internal';
import { boardStatusColumns, ensureWorkflowStatusColumns, normalizeStatusColumn, sortTasksByFlowOrder, statusColumnLabel } from '@/lib/internal-campaigns';
import InternalTaskCard from '@/components/internal/InternalTaskCard';

export default function InternalBoard({
  tasks,
  onTaskClick,
  onStatusChange,
  statusColumns = null,
  board = null,
  flowData = null,
}) {
  const { t } = useLocale();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const orderIndex = useMemo(() => {
    const ordered = flowData ? sortTasksByFlowOrder(tasks, flowData) : tasks;
    const map = new Map();
    ordered.forEach((task, index) => map.set(task.id, index));
    return map;
  }, [tasks, flowData]);

  function sortColumnTasks(colTasks) {
    return [...colTasks].sort(
      (a, b) => (orderIndex.get(a.id) ?? 9999) - (orderIndex.get(b.id) ?? 9999)
    );
  }

  const columns = useMemo(() => {
    if (statusColumns?.length) {
      return statusColumns.map(col => normalizeStatusColumn(col)).filter(Boolean);
    }
    if (board) return boardStatusColumns(board);
    return ensureWorkflowStatusColumns(BOARD_STATUSES);
  }, [statusColumns, board]);

  const columnIds = useMemo(() => new Set(columns.map(c => c.id)), [columns]);

  const orphanTasks = useMemo(
    () => tasks.filter(task => !columnIds.has(task.status)),
    [tasks, columnIds]
  );

  function onDragStart(e, taskId) {
    setDragId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }

  function onDragOver(e, colId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverCol(colId);
  }

  function onDrop(e, colId) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const task = tasks.find(x => x.id === id);
    if (task && task.status !== colId) onStatusChange(task, colId);
  }

  function renderColumn(col, { orphan = false } = {}) {
    const colTasks = sortColumnTasks(
      orphan ? orphanTasks : tasks.filter(task => task.status === col.id)
    );
    return (
      <div
        key={col.id}
        className={`internal-board-col is-${orphan ? 'orphan' : col.id}${orphan ? ' is-orphan' : ''}${!orphan && overCol === col.id ? ' is-drop-target' : ''}${col.id === 'in_review' ? ' is-review-queue' : ''}`}
        onDragOver={orphan ? undefined : e => onDragOver(e, col.id)}
        onDragLeave={orphan ? undefined : () => setOverCol(c => (c === col.id ? null : c))}
        onDrop={orphan ? undefined : e => onDrop(e, col.id)}
      >
        <header className="internal-board-col-head">
          <span className={`internal-board-col-bar is-${col.id}`} aria-hidden="true" />
          <div className="internal-board-col-head-text">
            <h3>{statusColumnLabel(col, t)}</h3>
            {col.id === 'in_review' && (
              <p className="internal-board-col-hint">{t('hub.internal.reviewColumnHint')}</p>
            )}
          </div>
          <span className="internal-board-col-count">{colTasks.length}</span>
        </header>
        <div className="internal-board-col-body">
          {colTasks.length === 0 && (
            <p className="internal-board-col-empty">{t('hub.internal.boardEmptyColumn')}</p>
          )}
          {colTasks.map(task => (
            <InternalTaskCard
              key={task.id}
              task={task}
              draggable
              isDragging={dragId === task.id}
              onDragStart={e => onDragStart(e, task.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverCol(null);
              }}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="internal-board" aria-label={t('hub.internal.viewBoard')}>
      <div className="internal-board-scroll h-scroll h-scroll--hint h-scroll--bleed" tabIndex={0}>
        <div className="internal-board-cols">
          {columns.map(col => renderColumn(col))}
          {orphanTasks.length > 0 && renderColumn(
            { id: '__orphan__', label: t('hub.internal.statusColumnOrphan') },
            { orphan: true }
          )}
        </div>
      </div>
    </section>
  );
}
