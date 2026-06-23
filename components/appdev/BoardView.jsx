'use client';

import { STATUSES, formatIssueDate } from '@/lib/appdev';
import { formatWorkersDisplay, getIssueWorkers } from '@/lib/appdev-workers';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
function priorityClass(priority) {
  if (priority && priority !== 'none') return `priority-${priority}`;
  return '';
}

export default function BoardView({ issuesByStatus, openIssue, t }) {
  const { locale } = useLocale();
  return (
    <div className="appdev-board-wrap">
      <div className="appdev-board">
        {STATUSES.map(status => (
          <section key={status} className="appdev-column">
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
                  <button
                    type="button"
                    className={`appdev-issue ${priorityClass(issue.priority)}`}
                    onClick={() => openIssue(issue)}
                  >
                    <div className="appdev-issue-top">
                      <span className="appdev-issue-type">{t(`appdev.type.${issue.type || 'task'}`)}</span>
                      {issue.priority !== 'none' && (
                        <span className={`appdev-priority-dot ${priorityClass(issue.priority)}`} />
                      )}
                    </div>
                    <span className="appdev-issue-title">{issue.title}</span>
                    <div className="appdev-issue-foot">
                      <div className="appdev-issue-meta">
                        {issue.assigned_at && (
                          <span className="appdev-issue-date" title={t('appdev.board.assignedAt')}>
                            {formatIssueDate(issue.assigned_at, locale)}
                          </span>
                        )}
                        {(issue.comments?.length || 0) > 0 && (
                          <span className="appdev-comment-count" title={t('appdev.chat.title')}>
                            <Icon name="message" size={12} />
                            {issue.comments.length}
                          </span>
                        )}
                      </div>
                      {getIssueWorkers(issue).length > 0 ? (
                        <span className="appdev-worker" title={t('appdev.board.assignee')}>
                          {formatWorkersDisplay(issue, locale)}
                        </span>
                      ) : issue.assignee ? (
                        <span className="appdev-worker appdev-worker-muted" title={t('appdev.board.assigner')}>
                          {issue.assignee}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
