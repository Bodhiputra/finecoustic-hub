import { personKey } from '@/lib/appdev';
import { createHubNotification, notifyMany } from '@/lib/hub-notifications';
import { parseMentions } from '@/lib/mention-parse';
import { taskAssignerKey, workflowActionToStatus } from '@/lib/task-workflow';

function assignerName(task) {
  return String(task?.created_by || '').trim();
}

function assigneeName(task) {
  return String(task?.assignee || '').trim();
}

export async function notifyTaskAssigned(task, actor, { prevAssignee = '' } = {}) {
  const next = assigneeName(task);
  const prev = String(prevAssignee || '').trim();
  if (!next || personKey(next) === personKey(prev)) return null;
  if (personKey(next) === personKey(actor?.displayName)) return null;

  return createHubNotification({
    recipientName: next,
    type: 'assigned',
    entityType: 'task',
    entityId: task.id,
    title: task.title,
    actorName: actor?.displayName || '',
    dedupeKey: `assigned:${task.id}:${personKey(next)}:${Date.now()}`,
  });
}

export async function notifyTaskReviewRequest(task, actor) {
  const assigner = assignerName(task);
  const actorName = actor?.displayName || '';
  if (!assigner || personKey(assigner) === personKey(actorName)) return null;

  return createHubNotification({
    recipientName: assigner,
    type: 'review_request',
    entityType: 'task',
    entityId: task.id,
    title: task.title,
    actorName,
    payload: { requires_action: true },
    dedupeKey: `review_request:${task.id}:${personKey(assigner)}:${Date.now()}`,
  });
}

export async function notifyTaskWorkflowDone(task, actor) {
  const assignee = assigneeName(task) || assignerName(task);
  const actorName = actor?.displayName || '';
  if (!assignee || personKey(assignee) === personKey(actorName)) return null;

  return createHubNotification({
    recipientName: assignee,
    type: 'workflow_done',
    entityType: 'task',
    entityId: task.id,
    title: task.title,
    actorName,
    dedupeKey: `workflow_done:${task.id}:${personKey(assignee)}:${Date.now()}`,
  });
}

export async function notifyTaskSendBack(task, actor) {
  const assignee = assigneeName(task) || assignerName(task);
  const actorName = actor?.displayName || '';
  if (!assignee || personKey(assignee) === personKey(actorName)) return null;

  return createHubNotification({
    recipientName: assignee,
    type: 'status_change',
    entityType: 'task',
    entityId: task.id,
    title: task.title,
    actorName,
    payload: { from_status: 'in_review', to_status: 'in_progress', sent_back: true },
    dedupeKey: `send_back:${task.id}:${personKey(assignee)}:${Date.now()}`,
  });
}

export async function notifyTaskMentions(task, commentBody, actor, knownNames = []) {
  const mentions = parseMentions(commentBody, knownNames);
  const actorName = actor?.displayName || '';
  const jobs = mentions
    .filter(name => personKey(name) !== personKey(actorName))
    .map(name =>
      createHubNotification({
        recipientName: name,
        type: 'mention',
        entityType: 'task',
        entityId: task.id,
        title: task.title,
        actorName,
        dedupeKey: `mention:${task.id}:${personKey(name)}:${Date.now()}`,
      })
    );
  await Promise.all(jobs);
}

export async function runTaskUpdateSideEffects({ existing, next, actor, patch = {} }) {
  if (!next?.id || next.kind !== 'task') return;

  const jobs = [];

  if (patch.assignee !== undefined && next.assignee !== existing.assignee) {
    jobs.push(notifyTaskAssigned(next, actor, { prevAssignee: existing.assignee }));
  }

  if (patch.workflow_action) {
    const action = patch.workflow_action;
    if (action === 'request_review') jobs.push(notifyTaskReviewRequest(next, actor));
    if (action === 'approve') jobs.push(notifyTaskWorkflowDone(next, actor));
    if (action === 'send_back') jobs.push(notifyTaskSendBack(next, actor));
  } else if (patch.status !== undefined && next.status !== existing.status) {
    if (next.status === 'in_review') jobs.push(notifyTaskReviewRequest(next, actor));
    if (next.status === 'done' && existing.status === 'in_review') {
      jobs.push(notifyTaskWorkflowDone(next, actor));
    }
    if (next.status === 'in_progress' && existing.status === 'in_review') {
      jobs.push(notifyTaskSendBack(next, actor));
    }
  }

  await Promise.all(jobs);
}

export async function runTaskCommentSideEffects({ task, comment, actor, knownNames = [] }) {
  if (!task?.id || !comment?.body) return;
  await notifyTaskMentions(task, comment.body, actor, knownNames);
}

export { workflowActionToStatus, taskAssignerKey };
