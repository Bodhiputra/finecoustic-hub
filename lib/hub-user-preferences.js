/** Per-user hub UI preferences (stored on hub_users). */

export function normalizeShowScheduleDashboard(value) {
  return value !== false && value !== 'false' && value !== 0;
}

export function showScheduleDashboardForActor(actor) {
  if (actor?.isAdmin) return true;
  if (actor?.showScheduleDashboard === false) return false;
  return normalizeShowScheduleDashboard(actor?.showScheduleDashboard ?? true);
}
