/** Due-date helpers for appdev issues (`due_at` = target completion date). */

export const DUE_SOON_DAYS = 3;

function dueAtTimestamp(issue) {
  if (!issue?.due_at) return null;
  const t = new Date(issue.due_at).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Board/table order: earliest target completion first; no due date last. */
export function compareIssuesByDueAt(a, b) {
  const da = dueAtTimestamp(a);
  const db = dueAtTimestamp(b);
  if (da == null && db == null) {
    return String(a?.id || '').localeCompare(String(b?.id || ''), undefined, { numeric: true });
  }
  if (da == null) return 1;
  if (db == null) return -1;
  if (da !== db) return da - db;
  return String(a?.id || '').localeCompare(String(b?.id || ''), undefined, { numeric: true });
}

export function sortIssuesByDueAt(issues) {
  return [...issues].sort(compareIssuesByDueAt);
}

export function isIssueOverdue(issue, now = new Date()) {
  if (!issue?.due_at || issue.status === 'done') return false;
  const due = new Date(issue.due_at);
  if (Number.isNaN(due.getTime())) return false;
  const end = new Date(due);
  end.setHours(23, 59, 59, 999);
  return end < now;
}

export function isIssueDueSoon(issue, now = new Date()) {
  if (!issue?.due_at || issue.status === 'done' || isIssueOverdue(issue, now)) return false;
  const due = new Date(issue.due_at);
  if (Number.isNaN(due.getTime())) return false;
  const ms = due.getTime() - now.getTime();
  return ms >= 0 && ms <= DUE_SOON_DAYS * 24 * 60 * 60 * 1000;
}
