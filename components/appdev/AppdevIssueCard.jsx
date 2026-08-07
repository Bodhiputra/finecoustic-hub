'use client';

import Icon from '@/components/Icon';
import { IssueTypeLabel } from '@/components/appdev/IssueTypeField';
import { formatIssueDate } from '@/lib/appdev';
import { formatWorkersDisplay, getIssueWorkers } from '@/lib/appdev-workers';
import { isIssueDueSoon, isIssueOverdue } from '@/lib/appdev-due';

function HintChip({ className = '', title, children }) {
  return (
    <span className={['appdev-hint-chip', className].filter(Boolean).join(' ')} title={title}>
      {children}
    </span>
  );
}

export default function AppdevIssueCard({
  issue,
  locale,
  t,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
}) {
  const workers = getIssueWorkers(issue);
  const assigner = String(issue.assignee || '').trim();
  const overdue = isIssueOverdue(issue);
  const dueSoon = isIssueDueSoon(issue);
  const commentCount = issue.comments?.length || 0;
  const hasChips =
    issue.type || issue.due_at || assigner || workers.length > 0 || commentCount > 0;

  return (
    <button
      type="button"
      className={[
        'appdev-issue',
        overdue ? 'is-overdue' : '',
        isDragging ? 'is-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <span className="appdev-issue-title">{issue.title}</span>

      {hasChips && (
        <div className="appdev-issue-chips">
          {issue.type && (
            <HintChip className="is-type" title={issue.type}>
              <IssueTypeLabel type={issue.type} />
            </HintChip>
          )}
          {issue.due_at && (
            <HintChip
              className={`is-date${overdue ? ' is-overdue' : ''}${dueSoon ? ' is-due-soon' : ''}`}
              title={t('appdev.board.dueAt')}
            >
              <Icon name="calendar" size={12} />
              {formatIssueDate(issue.due_at, locale)}
            </HintChip>
          )}
          {commentCount > 0 && (
            <HintChip className="is-comments" title={t('appdev.chat.title')}>
              <Icon name="message" size={12} />
              {commentCount}
            </HintChip>
          )}
          {assigner && (
            <HintChip className="is-assigner" title={t('appdev.board.assigner')}>
              <span className="appdev-hint-chip-role">{t('appdev.board.chipAssigner')}</span>
              <span className="appdev-hint-chip-name">{assigner}</span>
            </HintChip>
          )}
          {workers.length > 0 && (
            <HintChip className="is-assignee" title={t('appdev.board.assignee')}>
              <span className="appdev-hint-chip-role">{t('appdev.board.chipAssignee')}</span>
              <span className="appdev-hint-chip-name">{formatWorkersDisplay(issue, locale)}</span>
            </HintChip>
          )}
        </div>
      )}
    </button>
  );
}
