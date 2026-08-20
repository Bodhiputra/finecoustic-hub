import { personKey } from '@/lib/appdev';

/** Core kanban workflow columns (custom board columns fall back to assigner-only moves). */
export const WORKFLOW_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

export const WORKFLOW_ACTIONS = {
  accept: 'in_progress',
  request_review: 'in_review',
  approve: 'done',
  send_back: 'in_progress',
};

export function workflowActionToStatus(action) {
  return WORKFLOW_ACTIONS[String(action || '').trim()] || null;
}

export function taskAssignerKey(task) {
  return personKey(task?.created_by);
}

export function taskAssigneeKey(task) {
  return personKey(task?.assignee);
}

export function isTaskAssigner(task, actorName) {
  const assigner = taskAssignerKey(task);
  if (!assigner) return false;
  return assigner === personKey(actorName);
}

/** Assignee, or assigner when nobody is assigned. */
export function isTaskAssignee(task, actorName) {
  const assignee = taskAssigneeKey(task);
  if (!assignee) return isTaskAssigner(task, actorName);
  return assignee === personKey(actorName);
}

export function isWorkflowTask(task) {
  return task?.kind === 'task';
}

export function canTransitionTaskStatus(task, fromStatus, toStatus, actorName, { isManager = false, isIntern = false } = {}) {
  const from = String(fromStatus || 'todo');
  const to = String(toStatus || '');
  if (!to || from === to) return true;
  if (!isWorkflowTask(task)) return true;

  const assigner = isTaskAssigner(task, actorName);
  const assignee = isTaskAssignee(task, actorName);

  if (to === 'cancelled') {
    if (isIntern) return false;
    return assigner || isManager;
  }

  if (to === 'done') {
    if (!assigner && !isManager) return false;
    if (from !== 'in_review' && !isManager) return false;
    return true;
  }

  if (from === 'todo' && to === 'in_progress') return assignee;
  if (from === 'in_progress' && to === 'in_review') return assignee;
  if (from === 'in_review' && to === 'in_progress') return assigner;

  const fromCore = WORKFLOW_STATUSES.includes(from);
  const toCore = WORKFLOW_STATUSES.includes(to);
  if (fromCore || toCore) return false;

  return assigner || isManager;
}

export function getWorkflowActions(task, actorName, { isManager = false } = {}) {
  if (!task?.id || !isWorkflowTask(task)) return [];
  const status = String(task.status || 'todo');
  const actions = [];

  if (status === 'todo' && isTaskAssignee(task, actorName)) {
    actions.push('accept');
  }
  if (status === 'in_progress' && isTaskAssignee(task, actorName)) {
    actions.push('request_review');
  }
  if (status === 'in_review' && isTaskAssigner(task, actorName)) {
    actions.push('approve', 'send_back');
  }

  if (
    status !== 'done'
    && status !== 'cancelled'
    && status !== 'archived'
    && (isTaskAssigner(task, actorName) || isManager)
    && !actions.includes('approve')
  ) {
    // Assigner can cancel from non-terminal states (not via board drag to done).
  }

  return actions;
}

export function assertTaskStatusTransition(task, nextStatus, actor, options = {}) {
  const actorName = typeof actor === 'string' ? actor : actor?.displayName;
  const isManager = options.isManager ?? Boolean(actor?.isManager);
  const isIntern = options.isIntern ?? (actor?.role === 'intern' && !actor?.isAdmin);
  const from = task?.status || 'todo';
  const to = nextStatus;

  if (!canTransitionTaskStatus(task, from, to, actorName, { isManager, isIntern })) {
    const err = new Error('invalid_status_transition');
    err.status = 403;
    throw err;
  }
}

export function resolveWorkflowPatch(existing, patch, actor) {
  const nextPatch = { ...patch };

  if (patch.workflow_action) {
    const status = workflowActionToStatus(patch.workflow_action);
    if (!status) {
      const err = new Error('invalid_workflow_action');
      err.status = 400;
      throw err;
    }
    nextPatch.status = status;
    delete nextPatch.workflow_action;
  }

  if (
    isWorkflowTask(existing)
    && nextPatch.status !== undefined
    && nextPatch.status !== existing.status
  ) {
    assertTaskStatusTransition(existing, nextPatch.status, actor);
  }

  return nextPatch;
}
