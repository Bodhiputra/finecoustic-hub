import { requireHubActor } from '@/lib/hub-actor';
import { personKey } from '@/lib/appdev';
import {
  createPersonalJot,
  deletePersonalJot,
  getPersonalJotById,
  listPersonalJotsForOwner,
  updatePersonalJot,
} from '@/lib/personal-jots-data';
import {
  restCreated,
  restError,
  restForbidden,
  restNoContent,
  restNotFound,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function ownerKeyFromActor(actor) {
  return personKey(actor?.displayName);
}

export async function listPersonalJots(_request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const ownerKey = ownerKeyFromActor(actor);
  if (!ownerKey) return restForbidden('forbidden');

  const jots = await listPersonalJotsForOwner(ownerKey);
  return restOk({ jots, count: jots.length });
}

export async function createPersonalJotHandler(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const body = await request.json().catch(() => ({}));
  try {
    const jot = await createPersonalJot(body, actor);
    return restCreated({ jot });
  } catch (e) {
    if (e.status === 403) return restForbidden('forbidden');
    throw e;
  }
}

export async function getPersonalJot(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const { id } = await params;
  const ownerKey = ownerKeyFromActor(actor);
  const jot = await getPersonalJotById(id, ownerKey);
  if (!jot) return restNotFound('not_found');
  return restOk({ jot });
}

export async function patchPersonalJot(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  const ownerKey = ownerKeyFromActor(actor);
  const body = await request.json().catch(() => ({}));

  try {
    const jot = await updatePersonalJot(id, body, ownerKey);
    return restOk({ jot });
  } catch (e) {
    if (e.status === 404) return restNotFound('not_found');
    throw e;
  }
}

export async function deletePersonalJotHandler(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  const ownerKey = ownerKeyFromActor(actor);
  const ok = await deletePersonalJot(id, ownerKey);
  if (!ok) return restNotFound('not_found');
  return restNoContent();
}
