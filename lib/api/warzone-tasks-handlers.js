import { requireHubActor } from '@/lib/hub-actor';
import { listTasksForActor, createTask, getTaskById, updateTask, deleteTask } from '@/lib/warzone-data';
import {
  restCreated,
  restError,
  restForbidden,
  restNoContent,
  restNotFound,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function actorError(e) {
  return restUnauthorized();
}

export async function listWarzoneTasks(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return actorError(e);
  }

  const { searchParams } = new URL(request.url);
  const department = searchParams.get('department') || '';
  const bucket = searchParams.get('bucket') || '';

  const tasks = await listTasksForActor(actor, {
    department: department || undefined,
    bucket: bucket || undefined,
  });

  return restOk({ tasks, count: tasks.length });
}

export async function createWarzoneTask(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return actorError(e);
  }

  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const body = await request.json().catch(() => ({}));
  try {
    const task = await createTask(body, actor);
    return restCreated({ task });
  } catch (e) {
    return restError(e.message || 'failed', e.status || 500);
  }
}

export async function getWarzoneTask(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return actorError(e);
  }

  const { id } = await params;
  const task = await getTaskById(id, actor);
  if (!task) return restNotFound();
  return restOk({ task });
}

export async function patchWarzoneTask(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return actorError(e);
  }

  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const task = await updateTask(id, body, actor);
    return restOk({ task });
  } catch (e) {
    return restError(e.message || 'failed', e.status || 404);
  }
}

export async function deleteWarzoneTask(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return actorError(e);
  }

  const { id } = await params;
  try {
    await deleteTask(id, actor);
    return restNoContent();
  } catch (e) {
    return restError(e.message || 'failed', e.status || 404);
  }
}
