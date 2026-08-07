import { resolveHubActor } from '@/lib/hub-actor';
import { listTasksForActor } from '@/lib/internal-data';
import { isUndatedTask, isTaskOverdue, todayKey } from '@/lib/internal';

function hubUserFromActor(actor) {
  if (!actor?.ok) return null;
  return {
    id: actor.userId,
    role: actor.role,
    isManager: actor.isManager,
    mustChangePassword: actor.mustChangePassword,
  };
}

export function countPersonalHubStats(tasks) {
  const key = todayKey();
  let today = 0;
  let overdue = 0;
  let inProgress = 0;
  let bank = 0;

  for (const t of tasks) {
    if (t.kind === 'task' && t.status === 'in_progress') inProgress += 1;
    if (t.kind === 'task' && t.status !== 'done' && t.status !== 'archived' && isUndatedTask(t)) {
      bank += 1;
    }
    if (t.status === 'done' || t.status === 'archived' || t.status === 'cancelled') continue;
    if (t.deadline === key || t.planned_for === key) today += 1;
    if (isTaskOverdue(t, key)) overdue += 1;
  }

  return { today, overdue, inProgress, bank };
}

/** Server load for /me — one task read, no duplicate bucket API calls. */
export async function loadPersonalHubPage() {
  const actor = await resolveHubActor();
  if (!actor.ok) {
    return {
      profile: { displayName: '', hubUser: null },
      stats: { today: 0, overdue: 0, inProgress: 0, bank: 0 },
    };
  }

  const tasks = await listTasksForActor(actor, {});
  return {
    profile: { displayName: actor.displayName, hubUser: hubUserFromActor(actor) },
    stats: countPersonalHubStats(tasks),
  };
}

export function hubMeFromActor(actor) {
  if (!actor?.ok) return null;
  return { displayName: actor.displayName, hubUser: hubUserFromActor(actor) };
}
