import { personKey } from '@/lib/appdev';
import { createHubNotification, resolveHubActionNotifications } from '@/lib/hub-notifications';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';
import { dismissStaleKolOutreachNotifications } from '@/lib/kol-outreach-alerts';
import { meetingNotificationRecipients } from '@/lib/meeting-notification-recipients';
import { parseMentions } from '@/lib/mention-parse';
import { isReviewQueueStatus, taskAssignerKey, workflowActionToStatus } from '@/lib/task-workflow';

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

/** Notify meeting attendees (and assignee when set) — skips organizer. */
export async function notifyMeetingScheduled(task, actor, { prevAttendees = [] } = {}) {
  if (task?.kind !== 'meeting') return;

  const actorName = actor?.displayName || '';
  const actorKey = personKey(actorName);
  const prevKeys = new Set(
    (Array.isArray(prevAttendees) ? prevAttendees : [])
      .map(name => personKey(name))
      .filter(Boolean)
  );

  const recipients = meetingNotificationRecipients(task).filter(name => {
    const key = personKey(name);
    if (!key || key === actorKey) return false;
    if (prevKeys.has(key)) return false;
    return true;
  });

  if (!recipients.length) return;

  const meetingDate = task.planned_for || task.deadline || '';
  const startTime = task.planned_for_time || task.deadline_time || '';

  await Promise.all(
    recipients.map(name =>
      createHubNotification({
        recipientName: name,
        type: 'meeting_scheduled',
        entityType: 'task',
        entityId: task.id,
        title: task.title,
        actorName,
        payload: {
          meeting_date: meetingDate,
          start_time: startTime,
          meeting_scope: task.meeting_scope || 'all',
        },
        dedupeKey: `meeting_scheduled:${task.id}:${personKey(name)}`,
      })
    )
  );
}

export async function notifyTaskReviewRequest(task, actor, { fromStatus = 'in_progress' } = {}) {
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
    payload: {
      from_status: fromStatus,
      to_status: 'in_review',
      requires_action: true,
      resolved: false,
    },
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
  return mentions;
}

/** Notify assigner + assignee when someone posts in Discussion (excluding author and @mentions). */
export async function notifyTaskDiscussionComment(task, comment, actor, { skipNames = [] } = {}) {
  const actorName = actor?.displayName || comment?.author || '';
  const actorKey = personKey(actorName);
  const skip = new Set(
    skipNames.map(name => personKey(name)).filter(Boolean)
  );
  if (actorKey) skip.add(actorKey);

  const recipients = [];
  for (const name of [assignerName(task), assigneeName(task)]) {
    const trimmed = String(name || '').trim();
    const key = personKey(trimmed);
    if (!trimmed || skip.has(key)) continue;
    if (recipients.some(r => personKey(r) === key)) continue;
    recipients.push(trimmed);
  }

  if (!recipients.length) return;

  const preview = String(comment?.body || '').trim().slice(0, 120);
  const hasMedia = Boolean(comment?.image_urls?.length || comment?.video_urls?.length);
  const commentId = comment?.id || Date.now();

  await Promise.all(
    recipients.map(name =>
      createHubNotification({
        recipientName: name,
        type: 'comment',
        entityType: 'task',
        entityId: task.id,
        title: task.title,
        actorName,
        payload: { preview, has_media: hasMedia },
        dedupeKey: `comment:${task.id}:${commentId}:${personKey(name)}`,
      })
    )
  );
}

export async function runTaskUpdateSideEffects({ existing, next, actor, patch = {} }) {
  if (!next?.id || next.kind !== 'task') return;

  const jobs = [];
  const statusChanged = next.status !== existing.status;

  if (String(next.board_id || '') === KOL_OUTREACH_BOARD_ID) {
    jobs.push(dismissStaleKolOutreachNotifications(next));
  }

  if (patch.assignee !== undefined && next.assignee !== existing.assignee) {
    jobs.push(notifyTaskAssigned(next, actor, { prevAssignee: existing.assignee }));
  }

  if (statusChanged) {
    if (isReviewQueueStatus(next.status)) {
      jobs.push(notifyTaskReviewRequest(next, actor, { fromStatus: existing.status }));
    }
    if (isReviewQueueStatus(existing.status) && !isReviewQueueStatus(next.status)) {
      jobs.push(resolveHubActionNotifications(next.id, 'task', ['review_request']));
    }
    if (next.status === 'done' && isReviewQueueStatus(existing.status)) {
      jobs.push(notifyTaskWorkflowDone(next, actor));
    }
    if (next.status === 'in_progress' && isReviewQueueStatus(existing.status)) {
      jobs.push(notifyTaskSendBack(next, actor));
    }
  } else if (patch.workflow_action === 'claim') {
    jobs.push(notifyTaskAssigned(next, actor, { prevAssignee: '' }));
  }

  await Promise.all(jobs);
}

export async function runTaskCommentSideEffects({ task, comment, actor, knownNames = [] }) {
  if (!task?.id || !comment) return;
  const mentioned = await notifyTaskMentions(task, comment.body || '', actor, knownNames);
  await notifyTaskDiscussionComment(task, comment, actor, { skipNames: mentioned });
}

export { workflowActionToStatus, taskAssignerKey };
