import { personKey } from '@/lib/appdev';

export const DEPARTMENTS = [
  {
    id: 'operations',
    path: '/ops',
    label: 'Operations',
    labelKey: 'hub.modules.operations.title',
    description: 'Inventory, B2B, stock, and warehouse reconciliation.',
    descriptionKey: 'hub.modules.operations.description',
    icon: 'box',
    dataLinks: [
      { id: 'dashboard', href: '/ops?tool=dashboard', label: 'Ops dashboard', labelKey: 'hub.warzone.opsDashboard' },
      { id: 'customers', href: '/ops?tool=customers', label: 'B2B customers', labelKey: 'hub.warzone.opsCustomers' },
      { id: 'stock', href: '/ops?tool=stock', label: 'Stock & warehouse', labelKey: 'hub.warzone.opsStock' },
    ],
  },
  {
    id: 'marketing',
    path: '/marketing',
    label: 'Marketing',
    labelKey: 'hub.modules.marketing.title',
    description: 'Campaigns, pre-order surveys, and storefront feedback.',
    descriptionKey: 'hub.modules.marketing.description',
    icon: 'megaphone',
    dataLinks: [
      {
        id: 'preorder-survey',
        href: '/marketing?tool=preorder-survey',
        label: 'FBS preorder questionnaire',
        labelKey: 'hub.warzone.fbsPreorderSurvey',
      },
    ],
  },
  {
    id: 'creatives',
    path: '/creatives',
    label: 'Creatives',
    labelKey: 'hub.warzone.deptCreatives',
    description: 'Design, video, copy, and social content.',
    descriptionKey: 'hub.warzone.deptCreativesDesc',
    icon: 'layout',
    dataLinks: [],
  },
  {
    id: 'products',
    path: '/products',
    label: 'Products',
    labelKey: 'hub.warzone.deptProducts',
    description: 'Product development, specs, and releases.',
    descriptionKey: 'hub.warzone.deptProductsDesc',
    icon: 'kanban',
    dataLinks: [],
  },
  {
    id: 'branding',
    path: '/branding',
    label: 'Branding',
    labelKey: 'hub.warzone.deptBranding',
    description: 'Brand guidelines, assets, and positioning.',
    descriptionKey: 'hub.warzone.deptBrandingDesc',
    icon: 'book',
    dataLinks: [],
  },
];

export const ALL_TASKS_PATH = '/tasks';

export function getDepartmentPath(id) {
  if (id === 'all') return ALL_TASKS_PATH;
  const dept = getDepartment(id);
  return dept?.path || `/${id}`;
}

export function getDepartmentIdFromPath(pathname) {
  const path = String(pathname || '').split('?')[0];
  const dept = DEPARTMENTS.find(d => d.path === path);
  return dept?.id || null;
}

export const DEPARTMENT_IDS = DEPARTMENTS.map(d => d.id);

export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled', 'archived'];

/** Kanban columns shown in department board view (Linear-style). */
export const BOARD_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];

export const CALENDAR_KIND_FILTERS = ['tasks', 'events', 'milestones'];

/** Home master calendar — tasks and milestones only (no "event" filter chip). */
export const MASTER_CALENDAR_KIND_FILTERS = ['tasks', 'milestones'];

export const TASK_PRIORITIES = ['none', 'urgent', 'high', 'medium', 'low'];

export const VISIBILITY = ['team', 'private'];

export const DEFAULT_SUBTYPES = {
  operations: ['inventory', 'b2b', 'warehouse', 'shipping'],
  marketing: ['campaign', 'kol', 'email', 'ads', 'survey'],
  creatives: ['design', 'video', 'copy', 'social'],
  products: ['dev', 'qa', 'release', 'spec'],
  branding: ['guidelines', 'assets', 'positioning'],
};

export function getDepartment(id) {
  return DEPARTMENTS.find(d => d.id === id) || null;
}

export function deptText(dept, t, field = 'label') {
  if (!dept) return '';
  const key = field === 'label' ? dept.labelKey : dept.descriptionKey;
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return field === 'label' ? dept.label : dept.description;
}

export function dataLinkLabel(link, t) {
  if (link.labelKey) {
    const translated = t(link.labelKey);
    if (translated !== link.labelKey) return translated;
  }
  return link.label;
}

export function normalizeDepartmentId(value) {
  const id = String(value || '').trim().toLowerCase();
  return DEPARTMENT_IDS.includes(id) ? id : 'operations';
}

export function parseQuickAddInput(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/^#(\w[-\w]*)\s+(.+)$/i);
  if (!match) return { title: text, department: null };
  const tag = match[1].toLowerCase();
  const dept = DEPARTMENTS.find(
    d => d.id === tag || d.id.startsWith(tag) || d.label.toLowerCase().startsWith(tag)
  );
  return { title: match[2].trim(), department: dept?.id || null };
}

export function emptyTask(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: '',
    kind: 'task',
    title: '',
    notes: '',
    department: 'operations',
    subtype: '',
    status: 'todo',
    priority: 'none',
    deadline: null,
    planned_for: null,
    visibility: 'team',
    owner: '',
    assignee: '',
    link_url: '',
    created_by: '',
    source: 'hub',
    rmp_id: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    ...partial,
  };
}

export function newTaskDraft(partial = {}) {
  return {
    ...emptyTask(partial),
    _draft: true,
    subtasks: Array.isArray(partial.subtasks) ? partial.subtasks : [],
  };
}

function normalizeSubtasks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, i) => ({
      id: String(s?.id || `st-${i}-${Date.now()}`),
      title: String(s?.title || '').trim().slice(0, 200),
      done: Boolean(s?.done),
    }))
    .filter(s => s.title);
}

export function normalizeTask(raw, actorName = '') {
  const t = raw || {};
  const visibility = VISIBILITY.includes(t.visibility) ? t.visibility : 'team';
  const owner =
    visibility === 'private'
      ? String(t.owner || actorName || '').trim()
      : String(t.owner || '').trim();

  return {
    id: String(t.id || ''),
    kind: t.kind === 'milestone' ? 'milestone' : t.kind === 'event' ? 'event' : 'task',
    title: String(t.title || '').trim().slice(0, 240),
    notes: String(t.notes || '').trim().slice(0, 8000),
    department: normalizeDepartmentId(t.department),
    subtype: String(t.subtype || '').trim().slice(0, 48),
    status: TASK_STATUSES.includes(t.status) ? t.status : 'todo',
    priority: TASK_PRIORITIES.includes(t.priority) ? t.priority : 'none',
    deadline: t.deadline ? String(t.deadline).slice(0, 10) : null,
    planned_for: t.planned_for ? String(t.planned_for).slice(0, 10) : null,
    visibility,
    owner,
    assignee: String(t.assignee || '').trim().slice(0, 80),
    link_url: String(t.link_url || '').trim().slice(0, 500),
    created_by: String(t.created_by || '').trim().slice(0, 80),
    source: String(t.source || 'hub').slice(0, 32),
    rmp_id: t.rmp_id ? String(t.rmp_id) : null,
    created_at: t.created_at || new Date().toISOString(),
    updated_at: t.updated_at || t.created_at || new Date().toISOString(),
    completed_at: t.completed_at || null,
    subtasks: normalizeSubtasks(t.subtasks),
  };
}

export function taskVisibleToActor(task, _actor) {
  if (!task) return false;
  return true;
}

export function taskDueDate(task) {
  return task?.deadline || task?.planned_for || null;
}

export function isUndatedTask(task) {
  return task?.kind === 'task' && !task.deadline && !task.planned_for;
}

/** Items with no calendar date yet (todo bank + undated events/milestones). */
export function isUnscheduledCalendarItem(task) {
  if (!task || task.status === 'archived') return false;
  if (task.kind === 'milestone') return !task.deadline;
  if (task.kind === 'event') return !task.planned_for && !task.deadline;
  if (task.kind === 'task') return task.status !== 'done' && isUndatedTask(task);
  return false;
}

export function isOverdueCalendarItem(task, today = todayKey()) {
  if (!task || task.status === 'done' || task.status === 'archived') return false;
  if (task.kind !== 'task') return false;
  return Boolean(task.deadline && task.deadline < today);
}

export function filterTasksBySearch(tasks, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter(task => String(task.title || '').toLowerCase().includes(q));
}

export function schedulePatchForDate(task, iso) {
  if (!task || !iso) return null;
  if (task.kind === 'event') {
    const end = task.deadline && task.deadline >= iso ? task.deadline : iso;
    return { planned_for: iso, deadline: end };
  }
  if (task.kind === 'milestone') return { deadline: iso };
  return { deadline: iso };
}

export function isScheduledTask(task) {
  return Boolean(task?.deadline || task?.planned_for);
}

export function datesForTask(task) {
  const out = [];
  if (task?.deadline) out.push(task.deadline);
  if (task?.planned_for && task.planned_for !== task.deadline) out.push(task.planned_for);
  return out;
}

function isoToDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(iso, days) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

/** Dates an item should appear on in month/week calendars */
export function expandCalendarDates(item) {
  if (!item) return [];
  if (item.kind === 'event') {
    const a = item.planned_for || item.deadline;
    const b = item.deadline || item.planned_for;
    if (!a && !b) return [];
    const start = a <= b ? a : b;
    const end = b >= a ? b : a;
    const out = [];
    let cur = start;
    while (cur <= end) {
      out.push(cur);
      if (cur === end) break;
      cur = addDaysIso(cur, 1);
      if (out.length > 366) break;
    }
    return out;
  }
  if (item.kind === 'milestone') return item.deadline ? [item.deadline] : [];
  if (item.kind === 'task') {
    const dates = new Set();
    if (item.deadline) dates.add(item.deadline);
    if (item.planned_for) dates.add(item.planned_for);
    return [...dates];
  }
  return item.deadline ? [item.deadline] : [];
}

export function buildCalendarMap(items) {
  const map = {};
  for (const item of items) {
    for (const d of expandCalendarDates(item)) {
      if (!map[d]) map[d] = [];
      if (!map[d].some(x => x.id === item.id)) map[d].push(item);
    }
  }
  return map;
}

export function eventRangeLabel(item) {
  if (item?.kind !== 'event') return null;
  const start = item.planned_for;
  const end = item.deadline;
  if (start && end && start !== end) return `${start} → ${end}`;
  return start || end || null;
}

export function isTeamScheduleItem(item) {
  if (!item || item.status === 'archived') return false;
  if (item.kind === 'event' || item.kind === 'milestone') return expandCalendarDates(item).length > 0;
  if (item.kind === 'task') {
    return item.status !== 'done' && item.status !== 'cancelled' && Boolean(item.deadline);
  }
  return false;
}

/** Landing calendar filter — tasks, milestones, and legacy date-range items (kind event). */
export function calendarItemMatchesKindFilter(item, activeFilters) {
  const filters = activeFilters instanceof Set ? activeFilters : new Set(activeFilters || CALENDAR_KIND_FILTERS);
  if (!item || filters.size === 0) return false;
  if (item.kind === 'task') {
    return filters.has('tasks') && expandCalendarDates(item).length > 0;
  }
  if (item.kind === 'event') {
    return filters.has('milestones') && expandCalendarDates(item).length > 0;
  }
  if (item.kind === 'milestone') {
    return filters.has('milestones') && expandCalendarDates(item).length > 0;
  }
  return false;
}

export function calendarItemMatchesDepartmentFilter(item, activeDepartments) {
  const filters = activeDepartments instanceof Set
    ? activeDepartments
    : new Set(activeDepartments || DEPARTMENT_IDS);
  if (!filters.size || filters.size >= DEPARTMENT_IDS.length) return true;
  return filters.has(normalizeDepartmentId(item?.department));
}

export function isActiveTaskStatus(status) {
  return status !== 'done' && status !== 'cancelled' && status !== 'archived';
}

export function isTaskOverdue(task, today = todayKey()) {
  if (!task || task.kind !== 'task') return false;
  if (!isActiveTaskStatus(task.status)) return false;
  return Boolean(task.deadline && task.deadline < today);
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** People linked to a task (assignee preferred, then owner, creator). */
export function getTaskPeople(task) {
  const out = [];
  const seen = new Set();
  const fields = [task?.assignee, task?.owner, task?.created_by];
  for (const field of fields) {
    const name = String(field || '').trim();
    if (!name) continue;
    const key = personKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, name });
  }
  return out;
}

export function collectPeopleFromTasks(tasks) {
  const map = new Map();
  for (const task of tasks || []) {
    for (const person of getTaskPeople(task)) {
      if (!map.has(person.key)) map.set(person.key, person.name);
    }
  }
  return [...map.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function parsePeopleParam(raw) {
  if (!raw) return new Set();
  return new Set(
    String(raw)
      .split(',')
      .map(part => personKey(part))
      .filter(Boolean)
  );
}

export function serializePeopleParam(keys) {
  const list = keys instanceof Set ? [...keys] : keys;
  return list.filter(Boolean).join(',');
}

export function taskMatchesPeopleFilter(task, selectedKeys) {
  if (!selectedKeys?.size) return true;
  return getTaskPeople(task).some(person => selectedKeys.has(person.key));
}

/** Build department /tasks URL preserving view + people filters. */
export function warzoneTasksUrl(basePath, { view = '', people = null } = {}) {
  const params = new URLSearchParams();
  if (view) params.set('view', view);
  const peopleStr =
    people instanceof Set ? serializePeopleParam(people) : String(people || '').trim();
  if (peopleStr) params.set('people', peopleStr);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function togglePeopleKey(selectedKeys, key) {
  const next = new Set(selectedKeys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
