'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import ProductIssueCard from '@/components/products/ProductIssueCard';
import { useLocale } from '@/components/LocaleProvider';
import { ISSUE_BOARD_COLUMNS, issueSourceLabel, issueStatusLabel } from '@/lib/products';

export default function ProductIssuesBoard({
  sku,
  issues = [],
  view = 'board',
  onViewChange,
  onIssueClick,
  onStatusChange,
  onAddIssue,
}) {
  const { t } = useLocale();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const columns = useMemo(
    () => ISSUE_BOARD_COLUMNS.map(col => ({
      ...col,
      label: t(col.labelKey),
    })),
    [t]
  );

  function issuesInColumn(col) {
    const ids = col.statusIds || [col.id];
    return issues.filter(item => ids.includes(item.status));
  }

  function onDragStart(e, id) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDrop(e, col) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const item = issues.find(x => x.id === id);
    const nextStatus = col.statusIds?.[0] || col.id;
    if (item && item.status !== nextStatus) onStatusChange?.(item, nextStatus);
  }

  return (
    <section className={`products-section${view === 'board' ? ' products-section--wide' : ''}`}>
      <header className="products-section-head">
        <div className="products-section-intro">
          <h2>{t('hub.products.issuesTitle')}</h2>
          <p>{t('hub.products.issuesDesc')}</p>
        </div>
        <div className="products-section-head-actions">
          <div className="internal-dept-view-tabs products-issues-view-tabs" role="toolbar">
            <button
              type="button"
              className={`internal-dept-view-tab${view === 'board' ? ' is-active' : ''}`}
              onClick={() => onViewChange('board')}
            >
              <Icon name="kanban" size={15} />
              Board
            </button>
            <button
              type="button"
              className={`internal-dept-view-tab${view === 'list' ? ' is-active' : ''}`}
              onClick={() => onViewChange('list')}
            >
              <Icon name="layout" size={15} />
              List
            </button>
          </div>
          <button type="button" className="appdev-btn-primary" onClick={onAddIssue}>
            <Icon name="plus" size={16} />
            {t('hub.products.addIssue')}
          </button>
        </div>
      </header>

      {view === 'list' && !issues.length ? (
        <div className="products-section-empty">
          <Icon name="message" size={28} />
          <p>{t('hub.products.noIssues')}</p>
          <button type="button" className="appdev-btn-primary" onClick={onAddIssue}>
            <Icon name="plus" size={16} />
            {t('hub.products.addIssue')}
          </button>
        </div>
      ) : view === 'list' ? (
        <ul className="products-issue-list">
          {issues.map(item => (
            <li key={item.id}>
              <button type="button" className="products-issue-list-row" onClick={() => onIssueClick(item)}>
                <span className={`products-issue-list-status is-${item.status}`}>
                  {issueStatusLabel(item.status, t)}
                </span>
                <span className="products-issue-list-title">{item.title}</span>
                <span className="products-issue-list-meta">
                  {issueSourceLabel(item.source)}
                  {item.comments?.length ? ` · ${item.comments.length} msg` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="internal-board products-issue-board" aria-label={t('hub.products.issuesTitle')}>
          <div className="internal-board-scroll h-scroll h-scroll--hint h-scroll--bleed" tabIndex={0}>
            <div className="internal-board-cols products-issue-board-cols">
              {columns.map(col => {
                const colIssues = issuesInColumn(col);
                return (
                  <div
                    key={col.id}
                    className={`internal-board-col is-${col.id}${overCol === col.id ? ' is-drop-target' : ''}`}
                    onDragOver={e => {
                      e.preventDefault();
                      setOverCol(col.id);
                    }}
                    onDragLeave={() => setOverCol(c => (c === col.id ? null : c))}
                    onDrop={e => onDrop(e, col)}
                  >
                    <header className="internal-board-col-head">
                      <span className={`internal-board-col-bar is-${col.id}`} aria-hidden="true" />
                      <h3>{col.label}</h3>
                      <span className="internal-board-col-count">{colIssues.length}</span>
                    </header>
                    <div className="internal-board-col-body">
                      {colIssues.length === 0 ? (
                        <p className="internal-board-col-empty">{t('hub.internal.boardEmptyColumn')}</p>
                      ) : null}
                      {colIssues.map(item => (
                        <ProductIssueCard
                          key={item.id}
                          item={item}
                          draggable
                          isDragging={dragId === item.id}
                          onDragStart={e => onDragStart(e, item.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverCol(null);
                          }}
                          onClick={() => onIssueClick(item)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
