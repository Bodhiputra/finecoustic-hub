import { personKey, normalizeIssueType } from '@/lib/appdev';
import { getIssueWorkers, isUserAmongWorkers } from '@/lib/appdev-workers';

export function issueMatchesAssigneeFilter(issue, assigneeFilter, currentUser) {
  if (assigneeFilter !== '__me__') return true;
  return isUserAmongWorkers(issue, currentUser);
}

export function issueMatchesTypeFilter(issue, typeFilter) {
  if (!typeFilter) return true;
  return personKey(normalizeIssueType(issue?.type)) === personKey(typeFilter);
}

export function issueMatchesSearch(issue, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return (
    issue.id.toLowerCase().includes(q) ||
    issue.title.toLowerCase().includes(q) ||
    (issue.assignee || '').toLowerCase().includes(q) ||
    getIssueWorkers(issue).some(w => w.toLowerCase().includes(q))
  );
}

export function filterIssues(issues, { search = '', assigneeFilter = '', typeFilter = '', currentUser = '' } = {}) {
  return (issues || []).filter(
    issue =>
      issueMatchesSearch(issue, search) &&
      issueMatchesAssigneeFilter(issue, assigneeFilter, currentUser) &&
      issueMatchesTypeFilter(issue, typeFilter)
  );
}
