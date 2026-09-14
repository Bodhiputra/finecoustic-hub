import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import { B2B_RETAILER_SECTION_IDS, countB2bBySection } from '@/lib/b2b-retailer-pool';
import {
  createB2bRetailerRecord,
  deleteB2bRetailerRecord,
  listB2bRetailerRecords,
  updateB2bRetailerRecord,
} from '@/lib/b2b-retailer-pool-data';
import {
  restError,
  restForbidden,
  restNoContent,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function requireOperationsAccess(actor) {
  if (actor.mustChangePassword) return restForbidden('must_change_password');
  if (!canAccessDepartment(actor, 'operations')) return restForbidden('department_forbidden');
  return null;
}

export async function getB2bRetailerPool(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOperationsAccess(actor);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') || 'all';
  const safeSection = B2B_RETAILER_SECTION_IDS.includes(section) ? section : 'all';

  const { records } = await listB2bRetailerRecords();
  const counts = countB2bBySection(records);

  return restOk({
    records,
    section: safeSection,
    counts,
    total: records.length,
  });
}

export async function postB2bRetailerPool(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOperationsAccess(actor);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  try {
    const record = await createB2bRetailerRecord(body);
    return restOk({ record });
  } catch (e) {
    if (e.status === 409 && e.message === 'partner_code_duplicate') {
      return restError('partner_code_duplicate', 409);
    }
    if (e.status === 400) {
      if (e.message === 'name_required') return restError('name_required', 400);
      if (e.message === 'tag_required') return restError('tag_required', 400);
      return restError(e.message, 400);
    }
    throw e;
  }
}

export async function loadB2bRetailerPoolForPage() {
  const { records } = await listB2bRetailerRecords();
  return {
    records,
    counts: countB2bBySection(records),
    total: records.length,
  };
}

export async function patchB2bRetailerPoolRecord(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOperationsAccess(actor);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const record = await updateB2bRetailerRecord(id, body);
    return restOk({ record });
  } catch (e) {
    if (e.status === 404) return restError('not_found', 404);
    if (e.status === 409) return restError('partner_code_duplicate', 409);
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function deleteB2bRetailerPoolRecordHandler(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOperationsAccess(actor);
  if (denied) return denied;

  const { id } = await params;

  const deleted = await deleteB2bRetailerRecord(id);
  if (!deleted) return restError('not_found', 404);
  return restNoContent();
}
