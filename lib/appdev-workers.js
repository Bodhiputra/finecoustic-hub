import { mergePeople, personKey } from '@/lib/appdev';

export function normalizeWorkers(value) {
  if (Array.isArray(value)) {
    const seen = new Set();
    const out = [];
    for (const raw of value) {
      const name = String(raw || '').trim();
      const key = personKey(name);
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
    return out;
  }
  const single = String(value || '').trim();
  return single ? [single] : [];
}

export function getIssueWorkers(issue) {
  if (!issue || typeof issue !== 'object') return [];
  if (Array.isArray(issue.workers)) return normalizeWorkers(issue.workers);
  return normalizeWorkers(issue.worker);
}

export function hasWorkers(workersOrIssue) {
  if (Array.isArray(workersOrIssue) || typeof workersOrIssue === 'string') {
    return normalizeWorkers(workersOrIssue).length > 0;
  }
  return getIssueWorkers(workersOrIssue).length > 0;
}

export function workersEqual(a, b) {
  const left = normalizeWorkers(a);
  const right = normalizeWorkers(b);
  if (left.length !== right.length) return false;
  return left.every((name, i) => personKey(name) === personKey(right[i]));
}

export function formatWorkersDisplay(issue, locale = 'en') {
  const workers = getIssueWorkers(issue);
  if (!workers.length) return '—';
  if (workers.length <= 2) return workers.join(', ');
  const sep = locale === 'zh' ? '、' : ', ';
  return `${workers.slice(0, 2).join(sep)} +${workers.length - 2}`;
}

export function isUserAmongWorkers(issue, displayName) {
  const key = personKey(displayName);
  if (!key) return false;
  return getIssueWorkers(issue).some(w => personKey(w) === key);
}

export function addWorker(workers, name) {
  const next = normalizeWorkers(workers);
  const key = personKey(name);
  if (!key || next.some(w => personKey(w) === key)) return next;
  return [...next, String(name).trim()];
}

export function removeWorker(workers, name) {
  const key = personKey(name);
  return normalizeWorkers(workers).filter(w => personKey(w) !== key);
}

/** Every worker must match a name in the assignable pool (registered users). */
export function workersInPool(workers, pool) {
  const allowed = new Set(normalizeWorkers(pool).map(personKey));
  const list = normalizeWorkers(workers);
  if (!list.length) return true;
  return list.every(w => allowed.has(personKey(w)));
}

export function collectWorkerNames(issues) {
  const names = [];
  for (const issue of issues || []) {
    names.push(...getIssueWorkers(issue));
  }
  return mergePeople([], names);
}
