import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import { canEditKnowledge } from '@/lib/hub-permissions';
import {
  createPage,
  deletePage,
  ensureFinecousticWikiSeed,
  getPageById,
  listPagesForDepartment,
  updatePage,
} from '@/lib/knowledge-data';
import { FINEACOUSTIC_WIKI_DEPARTMENT } from '@/lib/knowledge';
import {
  restCreated,
  restError,
  restForbidden,
  restNoContent,
  restNotFound,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function actorError() {
  return restUnauthorized();
}

export async function listKnowledgePages(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  const { searchParams } = new URL(request.url);
  const department = searchParams.get('department') || '';
  if (!department) return restError('department_required', 400);
  if (!canAccessDepartment(actor, department)) return restForbidden('department_forbidden');

  try {
    if (department === FINEACOUSTIC_WIKI_DEPARTMENT) {
      await ensureFinecousticWikiSeed(actor.displayName || 'Fine Teams');
    }
    const pages = await listPagesForDepartment(department);
    return restOk({ pages, count: pages.length });
  } catch (e) {
    return restError(e.message || 'failed', e.status || 500);
  }
}

export async function createKnowledgePage(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const body = await request.json().catch(() => ({}));
  const department = String(body.department || '').trim();
  if (!department) return restError('department_required', 400);
  if (!canEditKnowledge(actor, department)) return restForbidden('forbidden');

  try {
    const page = await createPage(body, actor);
    return restCreated({ page });
  } catch (e) {
    return restError(e.message || 'failed', e.status || 500);
  }
}

export async function getKnowledgePage(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  const { id } = await params;
  const page = await getPageById(id);
  if (!page) return restNotFound();
  return restOk({ page });
}

export async function patchKnowledgePage(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  const existing = await getPageById(id);
  if (!existing) return restNotFound();
  if (!canEditKnowledge(actor, existing.department)) return restForbidden('forbidden');

  const body = await request.json().catch(() => ({}));
  try {
    const page = await updatePage(id, body, actor);
    return restOk({ page });
  } catch (e) {
    return restError(e.message || 'failed', e.status || 500);
  }
}

export async function removeKnowledgePage(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  const existing = await getPageById(id);
  if (!existing) return restNotFound();
  if (!canEditKnowledge(actor, existing.department)) return restForbidden('forbidden');

  try {
    await deletePage(id);
    return restNoContent();
  } catch (e) {
    return restError(e.message || 'failed', e.status || 500);
  }
}
