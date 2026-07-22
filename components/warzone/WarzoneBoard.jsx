'use client';

import { useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { BOARD_STATUSES } from '@/lib/warzone';
import WarzoneTaskCard from '@/components/warzone/WarzoneTaskCard';

const COLUMN_KEYS = {
  todo: 'hub.warzone.statusTodo',
  in_progress: 'hub.warzone.statusInProgress',
  in_review: 'hub.warzone.statusInReview',
  done: 'hub.warzone.statusDone',
  cancelled: 'hub.warzone.statusCancelled',
};

export default function WarzoneBoard({ tasks, onTaskClick, onStatusChange }) {
  const { t } = useLocale();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

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
    <section className="warzone-board" aria-label={t('hub.warzone.viewBoard')}>
      <div className="warzone-board-cols">
        {BOARD_STATUSES.map(colId => {
          const colTasks = tasks.filter(task => task.status === colId);
          return (
            <div
              key={colId}
              className={`warzone-board-col is-${colId}${overCol === colId ? ' is-drop-target' : ''}`}
              onDragOver={e => onDragOver(e, colId)}
              onDragLeave={() => setOverCol(c => (c === colId ? null : c))}
              onDrop={e => onDrop(e, colId)}
            >
              <header className="warzone-board-col-head">
                <span className={`warzone-board-col-bar is-${colId}`} aria-hidden="true" />
                <h3>{t(COLUMN_KEYS[colId])}</h3>
                <span className="warzone-board-col-count">{colTasks.length}</span>
              </header>
              <div className="warzone-board-col-body">
                {colTasks.length === 0 && (
                  <p className="warzone-board-col-empty">{t('hub.warzone.boardEmptyColumn')}</p>
                )}
                {colTasks.map(task => (
                  <WarzoneTaskCard
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
    </section>
  );
}
