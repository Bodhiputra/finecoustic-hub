import { personKey } from '@/lib/appdev';
import {
  addWorker,
  formatWorkersDisplay,
  isUserAmongWorkers,
  normalizeWorkers,
  removeWorker,
  workersEqual,
} from '@/lib/appdev-workers';

/** Who is doing the work — `assignees` array with legacy `assignee` fallback. */
export function getTaskAssignees(task) {
  if (!task || typeof task !== 'object') return [];
  if (Array.isArray(task.assignees)) return normalizeWorkers(task.assignees);
  return normalizeWorkers(task.assignee);
}

export function hasTaskAssignees(taskOrList) {
  return getTaskAssignees(taskOrList).length > 0;
}

export function isUserAmongTaskAssignees(task, displayName) {
  return isUserAmongWorkers({ workers: getTaskAssignees(task) }, displayName);
}

export function formatTaskAssigneesDisplay(task, locale = 'en') {
  return formatWorkersDisplay({ workers: getTaskAssignees(task) }, locale);
}

export function taskAssigneesEqual(a, b) {
  return workersEqual(getTaskAssignees({ assignees: a }), getTaskAssignees({ assignees: b }));
}

export { addWorker as addTaskAssignee, removeWorker as removeTaskAssignee, normalizeWorkers as normalizeTaskAssignees };

/** Keep legacy single `assignee` in sync for indexes, KOL outreach, and old clients. */
export function syncTaskAssigneeFields(task) {
  const assignees = getTaskAssignees(task);
  return {
    ...task,
    assignees,
    assignee: assignees[0] || '',
  };
}
