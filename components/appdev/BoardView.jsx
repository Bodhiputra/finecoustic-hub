'use client';

import { useState } from 'react';
import { STATUSES } from '@/lib/appdev';
import AppdevIssueCard from '@/components/appdev/AppdevIssueCard';

export default function BoardView({ issuesByStatus, openIssue, onStatusChange, t, locale }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  function onDragStart(e, issueId) {
    setDragId(issueId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', issueId);
  }

  function onDragOver(e, status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverCol(status);
  }

  function onDrop(e, status) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const issue = STATUSES.flatMap(s => issuesByStatus[s] || []).find(i => i.id === id);
    if (issue && issue.status !== status) onStatusChange?.(issue, status);
  }

  return (
    <div className="appdev-board-wrap">
      <div className="appdev-board">
        {STATUSES.map(status => (
          <section
            key={status}
            className={`appdev-column${overCol === status ? ' is-drop-target' : ''}`}
            onDragOver={e => onDragOver(e, status)}
            onDragLeave={() => setOverCol(c => (c === status ? null : c))}
            onDrop={e => onDrop(e, status)}
          >
            <header className="appdev-column-head">
              <h2>{t(`appdev.status.${status}`)}</h2>
              <span className="appdev-column-count">{issuesByStatus[status]?.length || 0}</span>
            </header>

            <ul className="appdev-cards">
              {(issuesByStatus[status] || []).length === 0 && (
                <li className="appdev-empty-col">{t('appdev.board.emptyColumn')}</li>
              )}
              {(issuesByStatus[status] || []).map(issue => (
                <li key={issue.id}>
                  <AppdevIssueCard
                    issue={issue}
                    locale={locale}
                    t={t}
                    draggable
                    isDragging={dragId === issue.id}
                    onDragStart={e => onDragStart(e, issue.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    onClick={() => openIssue(issue)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
