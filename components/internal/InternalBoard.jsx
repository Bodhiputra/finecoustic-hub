'use client';

import { useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { BOARD_STATUSES } from '@/lib/internal';
import InternalTaskCard from '@/components/internal/InternalTaskCard';

const COLUMN_KEYS = {
  todo: 'hub.internal.statusTodo',
  in_progress: 'hub.internal.statusInProgress',
  in_review: 'hub.internal.statusInReview',
  done: 'hub.internal.statusDone',
  cancelled: 'hub.internal.statusCancelled',
};

export default function InternalBoard({ tasks, onTaskClick, onStatusChange, statusColumns = null }) {
  const { t } = useLocale();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const columns = statusColumns?.length ? statusColumns : BOARD_STATUSES;

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

  return (
    <section className="internal-board" aria-label={t('hub.internal.viewBoard')}>
      <div className="internal-board-scroll h-scroll h-scroll--hint h-scroll--bleed" tabIndex={0}>
        <div className="internal-board-cols">
        {columns.map(colId => {
          const colTasks = tasks.filter(task => task.status === colId);
          return (
            <div
              key={colId}
              className={`internal-board-col is-${colId}${overCol === colId ? ' is-drop-target' : ''}`}
              onDragOver={e => onDragOver(e, colId)}
              onDragLeave={() => setOverCol(c => (c === colId ? null : c))}
              onDrop={e => onDrop(e, colId)}
            >
              <header className="internal-board-col-head">
                <span className={`internal-board-col-bar is-${colId}`} aria-hidden="true" />
                <h3>{COLUMN_KEYS[colId] ? t(COLUMN_KEYS[colId]) : colId}</h3>
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
        })}
        </div>
      </div>
    </section>
  );
}
