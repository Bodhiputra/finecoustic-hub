import { isUndatedTask, isTaskOverdue, taskAssignedToActor, todayKey } from '@/lib/internal';

/** Open assigned tasks (excludes done / archived / cancelled). */
export function countOpenAssignedTasks(tasks, actor) {
  if (!actor) return 0;
  let count = 0;
  for (const task of tasks) {
    if (task.kind !== 'task') continue;
    if (task.status === 'done' || task.status === 'archived' || task.status === 'cancelled') continue;
    if (taskAssignedToActor(task, actor)) count += 1;
  }
  return count;
}

/** Client-safe KPI counts for /me assigned tasks. */
export function countPersonalHubStats(tasks) {
  const key = todayKey();
  let today = 0;
  let overdue = 0;
  let inProgress = 0;
  let bank = 0;
  let assigned = 0;

  for (const t of tasks) {
    if (t.kind !== 'task') continue;
    if (t.status === 'done' || t.status === 'archived' || t.status === 'cancelled') continue;
    assigned += 1;
    if (t.status === 'in_progress') inProgress += 1;
    if (isUndatedTask(t)) bank += 1;
    if (t.deadline === key || t.planned_for === key) today += 1;
    if (isTaskOverdue(t, key)) overdue += 1;
  }

  return { today, overdue, inProgress, bank, assigned };
}
