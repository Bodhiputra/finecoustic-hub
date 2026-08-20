import { resolveHubActor } from '@/lib/hub-actor';
import { listTasksForActor } from '@/lib/internal-data';
import { countPersonalHubStats } from '@/lib/personal-hub-stats';
import { hubPermissionsForClient } from '@/lib/hub-permissions';

export { countPersonalHubStats };

function hubUserFromActor(actor) {
  if (!actor?.ok) return null;
  const permissions = hubPermissionsForClient(actor);
  return {
    id: actor.userId,
    role: actor.role,
    isManager: actor.isManager,
    isAdmin: actor.isAdmin,
    mustChangePassword: actor.mustChangePassword,
    departmentAccess: permissions?.departmentAccess || actor.departmentAccess,
    permissions,
  };
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
