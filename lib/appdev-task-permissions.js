import { personKey, STATUSES } from '@/lib/appdev';
import { normalizeVideoUrls } from '@/lib/appdev-media';
import { getIssueWorkers, hasWorkers, isUserAmongWorkers, normalizeWorkers, workersEqual } from '@/lib/appdev-workers';

/** Statuses non-owners may set. */
export const CONTRIBUTOR_STATUSES = ['todo', 'in_progress', 'in_review'];

/** Only task assigner or admin may set these. */
export const ASSIGNEE_ONLY_STATUSES = ['done'];

export function isTaskOwner(actor, issue) {
  if (actor?.isAdmin || actor?.authDisabled) return true;
  const name = actor?.displayName;
  if (!name) return false;
  return personKey(name) === personKey(issue?.assignee);
}

export function isTaskWorker(actor, issue) {
  if (actor?.isAdmin || actor?.authDisabled) return true;
  return isUserAmongWorkers(issue, actor?.displayName);
}

export function getIssueCapabilities(actor, issue) {
  const owner = isTaskOwner(actor, issue);
  const worker = isTaskWorker(actor, issue);
  const isAdmin = Boolean(actor?.isAdmin || actor?.authDisabled);
  const canParticipate = owner || worker;

  return {
    isOwner: owner,
    isWorker: worker,
    isAdmin,
    canEditMetadata: owner,
    canDelete: owner,
    canManageWorkers: owner,
    canClaimWork: !owner && !worker,
    canManageMedia: owner,
    canEditDates: owner,
    allowedStatuses: owner ? STATUSES : worker ? CONTRIBUTOR_STATUSES : [],
    canDiscuss: canParticipate,
    canChangeStatus: canParticipate,
  };
}

export function getStatusOptionsForIssue(issue, actor) {
  return getIssueCapabilities(actor, issue).allowedStatuses;
}

function normStr(v) {
  return String(v ?? '').trim();
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function contributorWorkersAllowed(currentWorkers, nextWorkers, actor) {
  const current = normalizeWorkers(currentWorkers);
  const next = normalizeWorkers(nextWorkers);
  const self = normStr(actor?.displayName);
  if (!self) return false;
  if (workersEqual(current, next)) return true;

  const selfKey = personKey(self);
  if (next.some(w => personKey(w) === selfKey) && current.some(w => personKey(w) === selfKey)) {
    return workersEqual(current, next);
  }

  if (next.length !== current.length + 1) return false;
  const added = next.filter(w => !current.some(c => personKey(c) === personKey(w)));
  if (added.length !== 1) return false;
  return personKey(added[0]) === selfKey;
}

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateIssueUpdate(current, patch, actor) {
  const caps = getIssueCapabilities(actor, current);
  const currentWorkers = getIssueWorkers(current);
  const nextWorkers =
    patch.workers !== undefined ? normalizeWorkers(patch.workers) : currentWorkers;
  const nextStatus = patch.status !== undefined ? patch.status : current.status;

  if (nextStatus === 'in_progress' && !hasWorkers(nextWorkers)) {
    return { ok: false, reason: 'worker_required' };
  }

  if (patch.workers !== undefined && !workersEqual(nextWorkers, currentWorkers)) {
    if (caps.canManageWorkers) {
      // assigner / admin — any worker list
    } else if (!contributorWorkersAllowed(currentWorkers, nextWorkers, actor)) {
      return { ok: false, reason: 'workers_not_allowed' };
    }
  }

  if (caps.canEditMetadata) {
    if (patch.status !== undefined && patch.status !== current.status) {
      if (!STATUSES.includes(patch.status)) {
        return { ok: false, reason: 'status_not_allowed' };
      }
    }
    return { ok: true };
  }

  if (patch.title !== undefined && normStr(patch.title) !== normStr(current.title)) {
    return { ok: false, reason: 'task_locked' };
  }
  if (patch.description !== undefined && normStr(patch.description) !== normStr(current.description)) {
    return { ok: false, reason: 'task_locked' };
  }
  if (patch.image_urls !== undefined && !jsonEqual(patch.image_urls, current.image_urls)) {
    return { ok: false, reason: 'task_locked' };
  }
  if (patch.video_urls !== undefined && !jsonEqual(patch.video_urls, current.video_urls || [])) {
    return { ok: false, reason: 'task_locked' };
  }
  if (patch.video_url !== undefined) {
    const nextVideos = normalizeVideoUrls(current.video_urls, patch.video_url);
    if (!jsonEqual(nextVideos, current.video_urls || [])) {
      return { ok: false, reason: 'task_locked' };
    }
  }
  if (patch.type !== undefined && patch.type !== current.type) {
    return { ok: false, reason: 'task_locked' };
  }
  if (patch.priority !== undefined && patch.priority !== current.priority) {
    return { ok: false, reason: 'task_locked' };
  }
  if (patch.assigned_at !== undefined && patch.assigned_at !== current.assigned_at) {
    return { ok: false, reason: 'task_locked' };
  }
  if (patch.completed_at !== undefined && patch.completed_at !== current.completed_at) {
    return { ok: false, reason: 'task_locked' };
  }

  if (patch.status !== undefined && patch.status !== current.status) {
    const effectiveIssue =
      patch.workers !== undefined ? { ...current, workers: nextWorkers } : current;
    if (!isTaskWorker(actor, effectiveIssue)) {
      return { ok: false, reason: 'assignee_required' };
    }
    if (ASSIGNEE_ONLY_STATUSES.includes(patch.status)) {
      return { ok: false, reason: 'status_assigner_only' };
    }
    if (!CONTRIBUTOR_STATUSES.includes(patch.status)) {
      return { ok: false, reason: 'status_not_allowed' };
    }
  }

  return { ok: true };
}

export function canCommentOnIssue(issue, actor) {
  if (actor?.authDisabled || actor?.isAdmin) return true;
  if (isTaskOwner(actor, issue)) return true;
  return isUserAmongWorkers(issue, actor?.displayName);
}

export function canDeleteIssue(issue, actor) {
  return getIssueCapabilities(actor, issue).canDelete;
}
