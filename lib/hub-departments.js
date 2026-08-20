/** Hub department access flags (per user). */

/** Operational areas toggled in /hub/admin. Wiki (All About Finecoustic) is not assignable. */
export const HUB_ASSIGNABLE_DEPARTMENT_IDS = ['operations', 'marketing', 'products', 'creatives'];

/** Labels for /hub/admin department checkboxes — keep in sync with ids above. */
export const HUB_ADMIN_DEPARTMENT_OPTIONS = [
  { id: 'operations', label: 'Operations' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'products', label: 'Products' },
  { id: 'creatives', label: 'Creatives' },
];

/** @deprecated use HUB_ASSIGNABLE_DEPARTMENT_IDS — finecoustic wiki is not assignable. */
export const HUB_DEPARTMENT_IDS = HUB_ASSIGNABLE_DEPARTMENT_IDS;

export const FINEACOUSTIC_WIKI_DEPARTMENT_ID = 'finecoustic';

/** New accounts start with no department access — managers assign explicitly. */
export function defaultDepartmentAccess(_role = 'associate') {
  return Object.fromEntries(HUB_ASSIGNABLE_DEPARTMENT_IDS.map(id => [id, false]));
}

/** Master admin (FCS-建宏 + master password) — all assignable departments. */
export function fullDepartmentAccess() {
  return Object.fromEntries(HUB_ASSIGNABLE_DEPARTMENT_IDS.map(id => [id, true]));
}

/**
 * Departments the user may see in nav / filters.
 * Unknown access (before auth resolves) returns none — never default to all.
 */
export function departmentsVisibleToUser({ isAdmin = false, departmentAccess = null, accessResolved = false } = {}, departments = []) {
  if (isAdmin) return departments;
  if (!accessResolved || !departmentAccess) return [];
  return departments.filter(d => Boolean(departmentAccess[d.id]));
}

export function departmentIdsVisibleToUser(options = {}, departmentIds = HUB_ASSIGNABLE_DEPARTMENT_IDS) {
  const access = options.departmentAccess;
  if (options.isAdmin) return [...departmentIds];
  if (!options.accessResolved || !access) return [];
  return departmentIds.filter(id => Boolean(access[id]));
}

export function normalizeDepartmentAccess(raw, _role = 'associate') {
  const base = defaultDepartmentAccess();
  if (!raw || typeof raw !== 'object') return base;
  const next = { ...base };
  for (const id of HUB_ASSIGNABLE_DEPARTMENT_IDS) {
    if (typeof raw[id] === 'boolean') next[id] = raw[id];
  }
  return next;
}

export function effectiveDepartmentAccess(actor) {
  if (actor?.isAdmin) return fullDepartmentAccess();
  return normalizeDepartmentAccess(actor?.departmentAccess, actor?.role);
}

export function canAccessDepartment(actor, departmentId) {
  if (actor?.isAdmin) return true;
  if (departmentId === 'admin') return Boolean(actor?.isAdmin);
  if (departmentId === FINEACOUSTIC_WIKI_DEPARTMENT_ID) {
    return Boolean(actor?.ok || actor?.displayName);
  }
  const access = effectiveDepartmentAccess(actor);
  return Boolean(access[departmentId]);
}

export function departmentAccessForApi(access, role) {
  return normalizeDepartmentAccess(access, role);
}

export function hasAnyDepartmentAccess(actor) {
  if (actor?.isAdmin) return true;
  const access = effectiveDepartmentAccess(actor);
  return HUB_ASSIGNABLE_DEPARTMENT_IDS.some(id => Boolean(access[id]));
}
