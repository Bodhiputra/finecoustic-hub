export const TASK_RECURRENCES = ['none', 'daily'];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeRecurrence(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'daily' ? 'daily' : 'none';
}

export function isDailyRecurringTask(task) {
  return task?.kind === 'task' && normalizeRecurrence(task?.recurrence) === 'daily';
}

function addDaysToDateKey(dateKey, days) {
  const base = dateKey || todayKey();
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** When a daily task is marked done, roll it forward to todo for the next calendar day. */
export function applyRecurrenceAfterComplete(task) {
  if (!isDailyRecurringTask(task) || task.status !== 'done') return task;

  const anchor = task.planned_for || task.deadline || todayKey();
  const nextDay = addDaysToDateKey(anchor, 1);

  return {
    ...task,
    status: 'todo',
    completed_at: null,
    planned_for: nextDay,
    deadline: task.deadline ? nextDay : task.deadline,
    deadline_time: task.deadline_time || null,
    planned_for_time: task.planned_for_time || null,
  };
}
