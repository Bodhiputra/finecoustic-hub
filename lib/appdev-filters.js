import { personKey } from '@/lib/appdev';
import { getIssueWorkers, isUserAmongWorkers } from '@/lib/appdev-workers';

export function issueMatchesAssigneeFilter(issue, assigneeFilter, currentUser) {
  if (!assigneeFilter) return true;
  if (assigneeFilter === '__me__') {
    return isUserAmongWorkers(issue, currentUser);
  }
  const key = personKey(assigneeFilter);
  return getIssueWorkers(issue).some(w => personKey(w) === key);
}

export function issueMatchesTypeFilter(issue, typeFilter) {
  if (!typeFilter) return true;
  return (issue.type || 'task') === typeFilter;
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

/** Names that appear as assignees on at least one issue. */
export function assigneeFilterOptions(issues) {
  const map = new Map();
  for (const issue of issues || []) {
    for (const name of getIssueWorkers(issue)) {
      const key = personKey(name);
      if (key && !map.has(key)) map.set(key, name);
    }
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
