import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import {
  createKolTrackingCode,
  deleteKolTrackingCode,
  listKolTrackingCodes,
} from '@/lib/kol-tracking-codes-data';
import {
  restError,
  restForbidden,
  restNoContent,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function requireMarketingAccess(actor) {
  if (actor.mustChangePassword) return restForbidden('must_change_password');
  if (!canAccessDepartment(actor, 'marketing')) return restForbidden('department_forbidden');
  return null;
}

export async function getKolTrackingCodes(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const entries = await listKolTrackingCodes({ query });

  return restOk({ entries, total: entries.length });
}

export async function postKolTrackingCode(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return restError('invalid_json', 400);
  }

  try {
    const { entry, created } = await createKolTrackingCode({
      kol_pool_id: body?.kol_pool_id,
      platform: body?.platform,
      notes: body?.notes,
      created_by: actor.displayName,
    });
    return restOk({ entry, created }, created ? 201 : 200);
  } catch (err) {
    const code = String(err?.message || 'create_failed');
    if (code === 'kol_pool_id_required') return restError(code, 400);
    if (code === 'kol_not_found') return restError(code, 404);
    if (code === 'code_allocation_failed') return restError(code, 503);
    console.error('[postKolTrackingCode]', err);
    return restError('create_failed', 500);
  }
}

export async function deleteKolTrackingCodeById(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const id = params?.id;
  const removed = await deleteKolTrackingCode(id);
  if (!removed) return restError('not_found', 404);
  return restNoContent();
}
