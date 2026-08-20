import { isScheduledTask, isTaskOverdue, isUndatedTask, todayKey } from '@/lib/internal';

/** Client-safe bucket view ids — shared by server loaders and client task filters. */
export const INTERNAL_BUCKET_VIEWS = new Set(['today', 'overdue', 'in_progress', 'bank', 'milestones']);

export function parseInternalBucket(viewParam = '') {
  return INTERNAL_BUCKET_VIEWS.has(viewParam) ? viewParam : '';
}

/** Client-side bucket filter — mirrors server `listTasksForActor` bucket branches. */
export function filterTasksByBucket(tasks, bucket) {
  if (!bucket) return tasks;
  const list = Array.isArray(tasks) ? tasks : [];
  const key = todayKey();

  if (bucket === 'bank') {
    return list.filter(
      t => t.kind === 'task' && t.status !== 'done' && t.status !== 'archived' && isUndatedTask(t)
    );
  }
  if (bucket === 'in_progress') {
    return list.filter(t => t.kind === 'task' && t.status === 'in_progress');
  }
  if (bucket === 'scheduled') {
    return list.filter(
      t => t.kind === 'task' && t.status !== 'archived' && isScheduledTask(t)
    );
  }
  if (bucket === 'today') {
    return list.filter(t => {
      if (t.status === 'done' || t.status === 'archived' || t.status === 'cancelled') return false;
      return t.deadline === key || t.planned_for === key;
    });
  }
  if (bucket === 'overdue') {
    return list.filter(t => isTaskOverdue(t, key));
  }
  if (bucket === 'milestones') {
    return list.filter(t => t.kind === 'milestone');
  }
  return list;
}
