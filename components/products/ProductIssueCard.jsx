'use client';

import { useLocale } from '@/components/LocaleProvider';
import { issueReporterTypeLabel, productPlatformLabel } from '@/lib/products';

export default function ProductIssueCard({ item, onClick, draggable = false, onDragStart, onDragEnd, isDragging = false }) {
  const { t } = useLocale();
  const commentCount = item.comments?.length || 0;
  const reporterType = item.reporter_type || item.source;

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
        <span className="internal-hint-chip">{issueReporterTypeLabel(reporterType)}</span>
        {item.platform ? (
          <span className="internal-hint-chip">{productPlatformLabel(item.platform, t)}</span>
        ) : null}
        {item.correspondent ? (
          <span className="internal-hint-chip is-assignee">{item.correspondent}</span>
        ) : null}
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
