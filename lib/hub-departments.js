/** Hub department access flags (per user). */

export const HUB_DEPARTMENT_IDS = ['operations', 'marketing', 'products', 'creatives', 'finecoustic'];

export function defaultDepartmentAccess(role = 'member') {
  const access = Object.fromEntries(HUB_DEPARTMENT_IDS.map(id => [id, true]));
  access.admin = role === 'manager';
  return access;
}

export function normalizeDepartmentAccess(raw, role = 'member') {
  const base = defaultDepartmentAccess(role);
  if (!raw || typeof raw !== 'object') return base;
  const next = { ...base };
  for (const id of HUB_DEPARTMENT_IDS) {
    if (typeof raw[id] === 'boolean') next[id] = raw[id];
  }
  if (typeof raw.admin === 'boolean') next.admin = raw.admin;
  return next;
}

export function canAccessDepartment(actor, departmentId) {
  if (actor?.isAdmin) return true;
  const access = actor?.departmentAccess || defaultDepartmentAccess(actor?.role);
  if (departmentId === 'admin') return Boolean(access.admin) || Boolean(actor?.isManager);
  return Boolean(access[departmentId]);
}

export function departmentAccessForApi(access, role) {
  return normalizeDepartmentAccess(access, role);
}
