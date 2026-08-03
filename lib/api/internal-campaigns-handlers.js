import { requireHubActor } from '@/lib/hub-actor';
import {
  createBoard,
  createCampaign,
  deleteCampaign,
  getBoardById,
  getCampaignById,
  listCampaigns,
  updateBoard,
  updateCampaign,
} from '@/lib/internal-campaigns-data';
import {
  restCreated,
  restError,
  restForbidden,
  restNotFound,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function actorError() {
  return restUnauthorized();
}

export async function listInternalCampaigns(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  const { searchParams } = new URL(request.url);
  const department = searchParams.get('department') || '';
  const campaigns = await listCampaigns({ department: department || undefined });
  return restOk({ campaigns, count: campaigns.length });
}

export async function createInternalCampaign(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const body = await request.json().catch(() => ({}));
  try {
    const campaign = await createCampaign(body, actor);
    return restCreated({ campaign });
  } catch (e) {
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function getInternalCampaign(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) return restNotFound('campaign_not_found');
  return restOk({ campaign });
}

export async function patchInternalCampaign(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const campaign = await updateCampaign(id, body);
    const full = await getCampaignById(id);
    return restOk({ campaign: full || campaign });
  } catch (e) {
    if (e.status === 404) return restNotFound('campaign_not_found');
    throw e;
  }
}

export async function deleteInternalCampaign(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  try {
    await deleteCampaign(id);
    return restOk({ deleted: true });
  } catch (e) {
    if (e.status === 404) return restNotFound('campaign_not_found');
    throw e;
  }
}

export async function createInternalBoard(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id: campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const board = await createBoard({ ...body, campaign_id: campaignId }, actor);
    return restCreated({ board });
  } catch (e) {
    if (e.status === 404) return restNotFound(e.message);
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function getInternalBoard(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  const { id } = await params;
  const board = await getBoardById(id);
  if (!board) return restNotFound('board_not_found');
  return restOk({ board });
}

export async function patchInternalBoard(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const board = await updateBoard(id, body);
    const full = await getBoardById(id);
    return restOk({ board: full || board });
  } catch (e) {
    if (e.status === 404) return restNotFound('board_not_found');
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}
