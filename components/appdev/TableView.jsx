'use client';

import { formatIssueDate } from '@/lib/appdev';
import IssueTypeField, { IssueTypeLabel } from '@/components/appdev/IssueTypeField';
import { formatWorkersDisplay } from '@/lib/appdev-workers';
import { getIssueCapabilities, getStatusOptionsForIssue } from '@/lib/appdev-task-permissions';
import { sortIssuesByDueAt } from '@/lib/appdev-due';
import { useLocale } from '@/components/LocaleProvider';

export default function TableView({
  issues,
  onPatch,
  openIssue,
  saving,
  currentUser = '',
  isAdmin = false,
  taskTypes = [],
  registerTaskType,
  t,
}) {
  const { locale } = useLocale();
  const actor = { isAdmin, displayName: currentUser };
  const sorted = sortIssuesByDueAt(issues);

  const openRow = issue => {
    if (saving) return;
    openIssue(issue);
  };

  return (
    <div className="appdev-table-wrap">
      <div className="appdev-table-scroll h-scroll h-scroll--bleed">
        <table className="data-table appdev-table">
          <thead>
            <tr>
              <th>{t('appdev.board.title')}</th>
              <th>{t('appdev.board.type')}</th>
              <th>{t('appdev.board.status')}</th>
              <th>{t('appdev.board.assigner')}</th>
              <th>{t('appdev.board.assignee')}</th>
              <th>{t('appdev.board.assignedAt')}</th>
              <th>{t('appdev.board.dueAt')}</th>
              <th>{t('appdev.board.completedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="appdev-table-empty">
                  {t('appdev.board.emptyTable')}
                </td>
              </tr>
            )}
            {sorted.map(issue => {
              const caps = getIssueCapabilities(actor, issue);
              const statusOptions = getStatusOptionsForIssue(issue, actor);

              return (
                <tr
                  key={issue.id}
                  className="appdev-table-row"
                  onClick={() => openRow(issue)}
                >
                  <td>
                    <span className="appdev-table-title">{issue.title}</span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {caps.canEditMetadata ? (
                      <IssueTypeField
                        value={issue.type}
                        onChange={next => onPatch(issue.id, { type: next })}
                        taskTypes={taskTypes}
                        onRegisterType={registerTaskType}
                        disabled={saving}
                        inputClassName="appdev-table-select appdev-type-input"
                      />
                    ) : (
                      <span className="appdev-table-text"><IssueTypeLabel type={issue.type} /></span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {caps.canChangeStatus ? (
                      <select
                        className="appdev-table-select"
                        value={issue.status}
                        disabled={saving}
                        onChange={e => onPatch(issue.id, { status: e.target.value })}
                        aria-label={`${t('appdev.board.status')} — ${issue.title}`}
                      >
                        {statusOptions.map(s => (
                          <option key={s} value={s}>{t(`appdev.status.${s}`)}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="appdev-table-text">{t(`appdev.status.${issue.status}`)}</span>
                    )}
                  </td>
                  <td>{issue.assignee || '—'}</td>
                  <td>{formatWorkersDisplay(issue, locale)}</td>
                  <td className="appdev-table-date">{formatIssueDate(issue.assigned_at, locale)}</td>
                  <td className="appdev-table-date">{formatIssueDate(issue.due_at, locale)}</td>
                  <td className="appdev-table-date">{formatIssueDate(issue.completed_at, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
