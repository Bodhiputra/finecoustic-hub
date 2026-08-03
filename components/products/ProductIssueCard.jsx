'use client';

import { issueSourceLabel } from '@/lib/products';

export default function ProductIssueCard({ item, onClick, draggable = false, onDragStart, onDragEnd, isDragging = false }) {
  const commentCount = item.comments?.length || 0;

  return (
    <button
      type="button"
      className={[
        'internal-task-card',
        'products-issue-card',
        isDragging && 'is-dragging',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="internal-task-card-title">{item.title}</span>
      <span className="internal-task-card-chips">
        <span className="internal-hint-chip">{issueSourceLabel(item.source)}</span>
        {item.assignee ? (
          <span className="internal-hint-chip is-assignee">{item.assignee}</span>
        ) : null}
        {commentCount > 0 ? (
          <span className="internal-hint-chip">{commentCount} msg</span>
        ) : null}
      </span>
    </button>
  );
}
