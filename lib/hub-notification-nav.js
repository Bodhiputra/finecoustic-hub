import { taskOriginUrl } from '@/lib/task-origin-url';

const TASK_LINK_TYPES = new Set([
  'assigned',
  'mention',
  'comment',
  'review_request',
  'workflow_done',
  'status_change',
  'reminder_due',
  'deadline_7d',
  'deadline_3d',
  'deadline_1d',
  'meeting_3h',
  'meeting_1h',
  'meeting_scheduled',
  'kol_waiting_3d',
  'kol_auto_no_deal',
  'kol_arrived_weekly',
]);

export function notificationLinksToTask(item) {
  if (!item) return false;
  const id = String(item.entity_id || '').trim();
  if (!id) return false;
  if (item.entity_type === 'task') return true;
  return TASK_LINK_TYPES.has(item.type);
}

export function taskFallbackUrl(taskId) {
  const id = String(taskId || '').trim();
  if (!id) return '/';
  return `/?task=${encodeURIComponent(id)}`;
}

export function taskNavigationUrl(task) {
  if (!task?.id) return '/';
  return taskOriginUrl(task);
}
