import { requireHubActor } from '@/lib/hub-actor';
import { listTasksForActor, createTask, getTaskById, updateTask, deleteTask, addTaskComment } from '@/lib/internal-data';
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

export async function listInternalTasks(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return actorError(e);
  }

  const { searchParams } = new URL(request.url);
  const department = searchParams.get('department') || '';
  const bucket = searchParams.get('bucket') || '';
  const board_id = searchParams.get('board_id') || '';
  const campaign_id = searchParams.get('campaign_id') || '';
  const flow_only = searchParams.get('flow_only') === '1';
  const hub_home = !department && !bucket && !board_id && !campaign_id && !flow_only;

  const tasks = await listTasksForActor(actor, {
    department: department || undefined,
    bucket: bucket || undefined,
    board_id: board_id || undefined,
    campaign_id: campaign_id || undefined,
    flow_only: flow_only || undefined,
    hub_home: hub_home || undefined,
  });

  return restOk({ tasks, count: tasks.length });
}

export async function createInternalTask(request) {
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

export async function getInternalTask(_request, { params }) {
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

export async function patchInternalTask(request, { params }) {
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
    return restError(e.message || 'failed', e.status || 404, { detail: e.detail });
  }
}

export async function deleteInternalTask(_request, { params }) {
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

export async function postInternalTaskComment(request, { params }) {
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
    const task = await addTaskComment(id, body, actor);
    return restCreated({ task });
  } catch (e) {
    return restError(e.message || 'failed', e.status || 400);
  }
}
