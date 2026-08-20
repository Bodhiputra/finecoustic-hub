import { personKey } from '@/lib/appdev';
import { createHubNotification } from '@/lib/hub-notifications';
import { listAllTasksForScheduleAlerts } from '@/lib/internal-data';
import { normalizeTime } from '@/lib/task-datetime';

/** Days before deadline to notify assignee + creator. */
export const DEADLINE_ALERT_DAYS = [7, 3, 1];

/** Hours before meeting start to notify assignee + creator. */
export const MEETING_ALERT_HOURS = [3, 1];

const DEFAULT_MEETING_TIME = '09:00';

function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDaysToIso(iso, days) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Wall-clock instant from YYYY-MM-DD + optional HH:MM (server timezone). */
function taskInstantFromDateTime(dateIso, timeValue, fallbackTime = DEFAULT_MEETING_TIME) {
  if (!dateIso) return null;
  const time = normalizeTime(timeValue) || normalizeTime(fallbackTime) || DEFAULT_MEETING_TIME;
  const instant = new Date(`${dateIso}T${time}:00`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function isActiveScheduleTask(task) {
  if (!task?.id) return false;
  const status = String(task.status || '');
  return status !== 'done' && status !== 'cancelled' && status !== 'archived';
}

/** Assignee + creator — deduped, non-empty. */
export function scheduleAlertRecipients(task) {
  const names = [];
  const seen = new Set();
  for (const field of [task.assignee, task.created_by]) {
    const name = String(field || '').trim();
    const key = personKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

async function notifyScheduleAlert({ task, type, recipientName, dedupeKey, payload }) {
  return createHubNotification({
    recipientName,
    type,
    entityType: 'task',
    entityId: task.id,
    title: task.title || 'Untitled',
    actorName: '',
    payload,
    dedupeKey,
  });
}

/** Scan open tasks/meetings and create deadline + meeting lead-time alerts. */
export async function processScheduleAlerts(now = new Date()) {
  const tasks = await listAllTasksForScheduleAlerts();
  const today = todayKey(now);
  let sent = 0;

  for (const task of tasks) {
    if (!isActiveScheduleTask(task)) continue;

    if (task.kind === 'task' && task.deadline) {
      for (const days of DEADLINE_ALERT_DAYS) {
        const alertDay = addDaysToIso(task.deadline, -days);
        if (alertDay !== today) continue;

        const type = `deadline_${days}d`;
        for (const name of scheduleAlertRecipients(task)) {
          const n = await notifyScheduleAlert({
            task,
            type,
            recipientName: name,
            dedupeKey: `schedule:${type}:${task.id}:${personKey(name)}:${task.deadline}`,
            payload: { due_date: task.deadline, days_before: days },
          });
          if (n) sent += 1;
        }
      }
    }

    if (task.kind === 'meeting') {
      const date = task.planned_for || task.deadline;
      const start = taskInstantFromDateTime(
        date,
        task.planned_for_time || task.deadline_time
      );
      if (!start) continue;

      const nowMs = now.getTime();
      const startMs = start.getTime();
      if (nowMs >= startMs) continue;

      for (const hours of MEETING_ALERT_HOURS) {
        const alertAtMs = startMs - hours * 60 * 60 * 1000;
        if (nowMs < alertAtMs) continue;

        const type = `meeting_${hours}h`;
        for (const name of scheduleAlertRecipients(task)) {
          const n = await notifyScheduleAlert({
            task,
            type,
            recipientName: name,
            dedupeKey: `schedule:${type}:${task.id}:${personKey(name)}:${date}:${task.planned_for_time || task.deadline_time || DEFAULT_MEETING_TIME}`,
            payload: {
              meeting_date: date,
              hours_before: hours,
              start_time: task.planned_for_time || task.deadline_time || DEFAULT_MEETING_TIME,
            },
          });
          if (n) sent += 1;
        }
      }
    }
  }

  return sent;
}
