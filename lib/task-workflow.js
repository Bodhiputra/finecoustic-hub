import { personKey } from '@/lib/appdev';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';
import { allowedKolTransition, normalizeKolOutreachStatus } from '@/lib/kol-outreach-shared';

/** Core kanban workflow columns (custom board columns fall back to assigner-only moves). */
export const WORKFLOW_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

/** Required on workflow kanbans — In Review is the assigner notification queue. */
export const WORKFLOW_LOCKED_COLUMN_IDS = ['todo', 'in_progress', 'in_review', 'done'];

export function isWorkflowLockedColumnId(id) {
  return WORKFLOW_LOCKED_COLUMN_IDS.includes(String(id || '').trim());
}

export function isReviewQueueStatus(status) {
  return String(status || '').trim() === 'in_review';
}

export const WORKFLOW_ACTIONS = {
  /** Self-assign an unassigned task and start work (no accept/decline). */
  claim: 'in_progress',
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

/** Person assigned to do the work (empty when unassigned). */
export function isTaskAssignee(task, actorName) {
  const assignee = taskAssigneeKey(task);
  if (!assignee) return false;
  return assignee === personKey(actorName);
}

export function isTaskUnassigned(task) {
  return !taskAssigneeKey(task);
}

/** Assigned tasks skip Todo — assignment means work has started. */
export function applyAutoStartWhenAssigned(task) {
  if (!isWorkflowTask(task)) return task;
  if (task.status !== 'todo') return task;
  if (!taskAssigneeKey(task)) return task;
  return { ...task, status: 'in_progress' };
}

/** Auto-start only when someone is newly assigned — not when pausing to Todo. */
export function shouldApplyAutoStartOnUpdate(existing, next, patch = {}) {
  if (!isWorkflowTask(next)) return false;
  if (next.status !== 'todo') return false;
  if (!taskAssigneeKey(next)) return false;
  if (patch.status === 'todo') return false;
  if (!taskAssigneeKey(existing) && taskAssigneeKey(next)) return true;
  return false;
}

export function isWorkflowTask(task) {
  return task?.kind === 'task';
}

export function isKolOutreachTask(task) {
  return String(task?.board_id || '') === KOL_OUTREACH_BOARD_ID;
}

function isWorkflowParticipant(task, actorName, { isManager = false, isAdmin = false } = {}) {
  return (
    isTaskAssigner(task, actorName)
    || isTaskAssignee(task, actorName)
    || isManager
    || isAdmin
    || (isTaskUnassigned(task) && Boolean(personKey(actorName)))
  );
}

function canTransitionKolOutreachStatus(task, fromStatus, toStatus, actorName, { isManager = false } = {}) {
  const from = normalizeKolOutreachStatus(fromStatus);
  const to = normalizeKolOutreachStatus(toStatus);
  if (!to || from === to) return true;
  if (from === 'no_deal' || from === 'publish') return false;
  if (!allowedKolTransition(from, to)) return false;
  return isTaskAssignee(task, actorName) || isManager;
}

export function canTransitionTaskStatus(task, fromStatus, toStatus, actorName, { isManager = false, isIntern = false, isAdmin = false } = {}) {
  const from = String(fromStatus || 'todo');
  const to = String(toStatus || '');
  if (!to || from === to) return true;
  if (!isWorkflowTask(task)) return true;

  if (isKolOutreachTask(task)) {
    return canTransitionKolOutreachStatus(task, from, to, actorName, { isManager });
  }

  if (to === 'cancelled') {
    if (isIntern) return false;
    return isTaskAssigner(task, actorName) || isManager || isAdmin;
  }

  return isWorkflowParticipant(task, actorName, { isManager, isAdmin });
}

/** Status columns the actor may pick in the task sidebar (flow canvas). */
export function getAllowedWorkflowStatusOptions(task, actorName, columns, { isManager = false, isAdmin = false, isNew = false } = {}) {
  const current = String(task?.status || 'todo');
  const list = Array.isArray(columns) ? columns : [];
  return list.filter(col => {
    const id = typeof col === 'string' ? col : col?.id;
    if (!id) return false;
    if (id === current || isNew) return true;
    return canTransitionTaskStatus(task, current, id, actorName, { isManager, isAdmin });
  });
}

export function getWorkflowActions(task, actorName, { isManager = false } = {}) {
  if (!task?.id || !isWorkflowTask(task)) return [];
  const status = String(task.status || 'todo');
  const actions = [];

  if (status === 'todo' && isTaskUnassigned(task) && personKey(actorName)) {
    actions.push('claim');
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
  const isAdmin = options.isAdmin ?? Boolean(actor?.isAdmin);
  const isIntern = options.isIntern ?? (actor?.role === 'intern' && !actor?.isAdmin);
  const from = task?.status || 'todo';
  const to = nextStatus;

  if (!canTransitionTaskStatus(task, from, to, actorName, { isManager, isIntern, isAdmin })) {
    const err = new Error('invalid_status_transition');
    err.status = 403;
    throw err;
  }
}

export function resolveWorkflowPatch(existing, patch, actor) {
  const nextPatch = { ...patch };
  const actorName = typeof actor === 'string' ? actor : actor?.displayName;

  if (patch.workflow_action === 'claim') {
    if (taskAssigneeKey(existing)) {
      const err = new Error('already_assigned');
      err.status = 403;
      throw err;
    }
    if (String(existing.status || 'todo') !== 'todo') {
      const err = new Error('invalid_status_transition');
      err.status = 403;
      throw err;
    }
    nextPatch.assignee = actorName;
    nextPatch.status = 'in_progress';
    delete nextPatch.workflow_action;
    assertTaskStatusTransition(existing, 'in_progress', actor);
    return nextPatch;
  }

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
