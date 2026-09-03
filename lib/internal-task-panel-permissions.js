import { personKey } from '@/lib/appdev';
import { normalizeFileUrls } from '@/lib/appdev-files';
import { isHubManager, isHubAdmin } from '@/lib/hub-permissions';
import { isKolOutreachTask, isTaskAssignee, isTaskAssigner } from '@/lib/task-workflow';

function normStr(v) {
  return String(v ?? '').trim();
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** UI + API gates for internal TaskPanel (assigner = created_by, assignee = assignee field). */
export function getTaskPanelCapabilities(task, actor = {}) {
  const displayName = actor.displayName || '';
  const isNew = Boolean(task?._draft || !task?.id);
  const manager = isHubManager(actor);
  const admin = isHubAdmin(actor);
  const assigner = isNew || isTaskAssigner(task, displayName);
  const assignee = isTaskAssignee(task, displayName);
  const unassignedWorkflow = !isNew && task?.kind === 'task' && !normStr(task?.assignee);
  const canEditMetadata = isNew || assigner || manager || admin;
  const kolOutreach = !isNew && isKolOutreachTask(task);
  const canEditKolFields = kolOutreach && (assignee || assigner || manager || admin);

  return {
    isNew,
    isAssigner: assigner,
    isAssignee: assignee,
    isManager: manager,
    isAdmin: admin,
    canEditMetadata,
    canEditKolFields,
    canManageAttachments: canEditMetadata,
    canEditAssignee: canEditMetadata,
    canEditCalendarFields: canEditMetadata,
    canManageCustomFields: canEditMetadata || (kolOutreach && assignee),
    canUseWorkflow: !isNew && (assigner || assignee || manager || admin || unassignedWorkflow),
    canComment: !isNew && (assigner || assignee || manager || admin),
    canSavePanel: canEditMetadata || canEditKolFields,
  };
}

const METADATA_KEYS = [
  'title',
  'notes',
  'department',
  'subtype',
  'priority',
  'recurrence',
  'assignee',
  'deadline',
  'deadline_time',
  'planned_for',
  'planned_for_time',
  'visibility',
  'link_url',
  'meeting_scope',
  'meeting_attendees',
  'meeting_department',
  'custom_values',
];

/**
 * Strip or reject metadata edits from non-assigners (server-side).
 * @returns {object} sanitized patch
 */
export function sanitizeTaskPatch(existing, patch, actor) {
  const caps = getTaskPanelCapabilities(existing, actor);
  if (caps.canEditMetadata) return { ...patch };

  const next = { ...patch };
  const kolFieldsOnly = caps.canEditKolFields;

  if (next.title !== undefined && normStr(next.title) !== normStr(existing.title)) {
    const err = new Error('task_locked');
    err.status = 403;
    throw err;
  }
  if (next.notes !== undefined && normStr(next.notes) !== normStr(existing.notes)) {
    const err = new Error('task_locked');
    err.status = 403;
    throw err;
  }
  if (next.image_urls !== undefined && !jsonEqual(next.image_urls, existing.image_urls || [])) {
    const err = new Error('task_locked');
    err.status = 403;
    throw err;
  }
  if (next.video_urls !== undefined && !jsonEqual(next.video_urls, existing.video_urls || [])) {
    const err = new Error('task_locked');
    err.status = 403;
    throw err;
  }
  if (next.file_urls !== undefined && !jsonEqual(normalizeFileUrls(next.file_urls), normalizeFileUrls(existing.file_urls))) {
    const err = new Error('task_locked');
    err.status = 403;
    throw err;
  }

  for (const key of METADATA_KEYS) {
    if (key === 'title' || key === 'notes') continue;
    if (kolFieldsOnly && key === 'custom_values') continue;
    if (kolFieldsOnly && key === 'assignee') {
      if (next.assignee !== undefined && personKey(next.assignee) !== personKey(existing.assignee)) {
        delete next.assignee;
      }
      continue;
    }
    if (next[key] !== undefined) delete next[key];
  }

  if (
    !kolFieldsOnly
    && METADATA_KEYS.some(key => patch[key] !== undefined && key !== 'title' && key !== 'notes')
  ) {
    const err = new Error('task_locked');
    err.status = 403;
    throw err;
  }

  if (next.kind !== undefined && next.kind !== existing.kind) {
    const err = new Error('task_locked');
    err.status = 403;
    throw err;
  }

  return next;
}

export function assertCanCommentOnTask(task, actor) {
  const caps = getTaskPanelCapabilities(task, actor);
  if (!caps.canComment) {
    const err = new Error('assignee_required');
    err.status = 403;
    throw err;
  }
}
