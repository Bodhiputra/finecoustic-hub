import { redirect } from 'next/navigation';
import { resolveHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';

/** Server-side gate for department routes — redirects if actor lacks access. */
export async function requireDepartmentPageAccess(departmentId, fallback = '/me') {
  const actor = await resolveHubActor();
  if (!actor.ok || !canAccessDepartment(actor, departmentId)) {
    redirect(fallback);
  }
  return actor;
}
