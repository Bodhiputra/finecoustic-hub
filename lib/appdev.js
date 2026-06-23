/**
 * Appdev issue field names (persisted JSON + DB).
 *
 * | JSON field   | UI label        | Meaning                                      |
 * |--------------|-----------------|----------------------------------------------|
 * | `assignee`   | Task assigner   | Who created/assigned the task (set once)     |
 * | `worker`     | Assignee (legacy) | First worker — kept in sync for old data    |
 * | `workers`    | Assignees         | Who is doing the work (one or more names)    |
 *
 * Do not rename JSON keys without a migration — UI/i18n use assigner/worker labels.
 */
import { normalizeImageUrls, normalizeVideoUrls } from './appdev-media';
import { getIssueWorkers, normalizeWorkers } from './appdev-workers';

export const STATUSES = [
  'todo',
  'in_progress',
  'in_review',
  'done',
];

export const PRIORITIES = ['none', 'urgent', 'high', 'medium', 'low'];

export const ISSUE_TYPES = ['task', 'bug_fix', 'new_feature', 'improvement'];

const LEGACY_STATUS_MAP = {
  backlog: 'todo',
  changes_requested: 'in_progress',
  cancelled: 'todo',
};

export const ISSUE_ID_PREFIX = 'FCS';

export function formatIssueId(num) {
  return `${ISSUE_ID_PREFIX}-${num}`;
}

export function parseIssueIdNum(id) {
  const match = String(id || '').match(/^FCS-(\d+)$/i);
  return match ? Number(match[1]) : null;
}

/** Next FCS serial for a new issue — does not reserve or increment. */
export function peekNextIssueNumber(board) {
  const counter = Number(board?.next_number);
  if (Number.isFinite(counter) && counter > 0) return counter;

  let max = 0;
  for (const issue of board?.issues || []) {
    const num = parseIssueIdNum(issue?.id);
    if (num != null) max = Math.max(max, num);
  }
  return max + 1;
}

/** Keep first occurrence of each issue id (list order preserved). */
export function dedupeIssuesById(issues) {
  const seen = new Set();
  const out = [];
  for (const issue of issues || []) {
    const id = issue?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(issue);
  }
  return out;
}

export function emptyBoard() {
  const now = new Date().toISOString();
  return {
    meta: { project: 'Finecoustic App Development', updated_at: now, people: [] },
    next_number: 1,
    issues: [],
  };
}

export function personKey(name) {
  return String(name || '').trim().toLowerCase();
}

export function formatIssueDate(iso, locale = 'en') {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** YYYY-MM-DD for native date inputs */
export function isoToDateInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD from date input to ISO (local noon, avoids TZ drift) */
export function dateInputValueToIso(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function parseIssueDatePatch(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function mergePeople(existing, ...nameLists) {
  const map = new Map();
  const add = list => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const name = String(raw || '').trim();
      const key = personKey(name);
      if (key && !map.has(key)) map.set(key, name);
    }
  };
  add(existing);
  for (const list of nameLists) add(list);
  return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function collectPeopleFromIssues(issues) {
  const names = [];
  for (const issue of issues || []) {
    if (issue.assignee) names.push(issue.assignee);
    names.push(...getIssueWorkers(issue));
    for (const c of issue.comments || []) {
      if (c.author) names.push(c.author);
    }
  }
  return names;
}

export function normalizeComment(comment, index = 0) {
  const body = typeof comment.body === 'string' ? comment.body.trim() : '';
  const image_urls = normalizeImageUrls(comment.image_urls);
  const video_urls = normalizeVideoUrls(comment.video_urls, comment.video_url);
  if (!body && !image_urls.length && !video_urls.length) return null;

  return {
    id: typeof comment.id === 'string' ? comment.id : `cmt-${index}`,
    author: typeof comment.author === 'string' ? comment.author : '',
    body,
    image_urls,
    video_urls,
    created_at: typeof comment.created_at === 'string' ? comment.created_at : new Date().toISOString(),
  };
}

export function touchPeople(board, ...names) {
  if (!board.meta) board.meta = { project: 'Finecoustic App Development', updated_at: new Date().toISOString() };
  board.meta.people = mergePeople(board.meta.people, names);
  return board.meta.people;
}

export function normalizeIssue(issue) {
  const next = { ...issue };
  if (LEGACY_STATUS_MAP[next.status]) {
    next.status = LEGACY_STATUS_MAP[next.status];
  }
  if (!STATUSES.includes(next.status)) next.status = 'todo';
  if (!PRIORITIES.includes(next.priority)) next.priority = 'none';
  if (!ISSUE_TYPES.includes(next.type)) next.type = 'task';
  next.workers = normalizeWorkers(
    Array.isArray(next.workers) ? next.workers : next.worker ? [next.worker] : []
  );
  next.worker = next.workers[0] || '';
  if (typeof next.assignee !== 'string') next.assignee = '';
  if (next.assigned_at != null && typeof next.assigned_at !== 'string') next.assigned_at = null;
  if (next.completed_at != null && typeof next.completed_at !== 'string') next.completed_at = null;
  if (!next.assigned_at && next.workers.length) {
    next.assigned_at = typeof next.created_at === 'string' ? next.created_at : null;
  }
  if (!next.completed_at && next.status === 'done') {
    next.completed_at = typeof next.updated_at === 'string' ? next.updated_at : null;
  }
  if (!next.workers.length) next.assigned_at = null;
  if (next.status !== 'done') next.completed_at = null;
  next.image_urls = normalizeImageUrls(next.image_urls);
  next.video_urls = normalizeVideoUrls(next.video_urls, next.video_url);
  delete next.video_url;
  if (!Array.isArray(next.comments)) {
    next.comments = [];
  } else {
    next.comments = next.comments
      .map((c, i) => normalizeComment(c, i))
      .filter(Boolean);
  }
  return next;
}

export function normalizeBoard(raw) {
  const board = raw && typeof raw === 'object' ? raw : emptyBoard();
  if (!board.meta) board.meta = { project: 'Finecoustic App Development', updated_at: new Date().toISOString(), people: [] };
  if (!Array.isArray(board.issues)) board.issues = [];
  board.issues = dedupeIssuesById(board.issues.map(normalizeIssue));
  if (typeof board.next_number !== 'number') {
    board.next_number = board.issues.length + 1;
  }
  board.meta.people = mergePeople(board.meta.people, collectPeopleFromIssues(board.issues));
  return board;
}
