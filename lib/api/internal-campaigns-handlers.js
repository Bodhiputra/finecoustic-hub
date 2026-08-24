import { requireHubActor } from '@/lib/hub-actor';
import {
  canCreateCampaign,
  canDeleteBoard,
  canDeleteCampaign,
  canEditBoardConfig,
} from '@/lib/hub-permissions';
import {
  canAccessBoard,
  createBoard,
  createCampaign,
  deleteBoard,
  deleteCampaign,
  getBoardById,
  getCampaignById,
  listBoardsForDepartment,
  listPersonalBoardsForActor,
  listCampaigns,
  listCampaignsForList,
  updateBoard,
  updateCampaign,
  isPersonalBoard,
} from '@/lib/internal-campaigns-data';
import { filterSidebarBoards } from '@/lib/sidebar-boards';
import { PERSONAL_DEPARTMENT_ID } from '@/lib/internal';
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
  const campaigns = await listCampaignsForList({ department: department || undefined });
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
  if (!canCreateCampaign(actor)) return restForbidden('forbidden');

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
  const existing = await getCampaignById(id);
  if (!existing) return restNotFound('campaign_not_found');
  if (
    body.name !== undefined
    && String(body.name || '').trim() !== existing.name
    && !canDeleteCampaign(actor, existing)
  ) {
    return restForbidden('forbidden');
  }
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
  const campaign = await getCampaignById(id);
  if (!campaign) return restNotFound('campaign_not_found');
  if (!canDeleteCampaign(actor, campaign)) return restForbidden('forbidden');

  try {
    await deleteCampaign(id);
    return restOk({ deleted: true });
  } catch (e) {
    if (e.status === 404) return restNotFound('campaign_not_found');
    throw e;
  }
}

export async function listInternalBoards(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || '';
  if (scope === 'personal') {
    const boards = filterSidebarBoards(await listPersonalBoardsForActor(actor));
    return restOk({ boards, count: boards.length });
  }

  const department = searchParams.get('department') || '';
  if (!department) return restError('department_required', 400);

  const forFlowPicker = searchParams.get('for_flow_picker') === '1';
  const raw = await listBoardsForDepartment(department);
  const boards = forFlowPicker ? raw : filterSidebarBoards(raw);
  return restOk({ boards, count: boards.length });
}

export async function createInternalDepartmentBoard(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const body = await request.json().catch(() => ({}));
  const scope = body?.scope || '';
  const department = body?.department || body?.department_id;

  if (scope === 'personal' || department === PERSONAL_DEPARTMENT_ID) {
    try {
      const board = await createBoard({ ...body, scope: 'personal' }, actor);
      const full = await getBoardById(board.id);
      return restCreated({ board: full || board });
    } catch (e) {
      if (e.status === 404) return restNotFound(e.message);
      if (e.status === 400) return restError(e.message, 400);
      throw e;
    }
  }

  if (!department) return restError('department_required', 400);

  try {
    const board = await createBoard({ ...body, department, campaign_id: null }, actor);
    const full = await getBoardById(board.id);
    return restCreated({ board: full || board });
  } catch (e) {
    if (e.status === 404) return restNotFound(e.message);
    if (e.status === 400) return restError(e.message, 400);
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
  if (!canAccessBoard(actor, board)) return restForbidden('forbidden');
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
  const existing = await getBoardById(id);
  if (!existing) return restNotFound('board_not_found');
  if (!canAccessBoard(actor, existing)) return restForbidden('forbidden');
  const canEdit = canEditBoardConfig(actor)
    || (isPersonalBoard(existing) && canAccessBoard(actor, existing));
  if (!canEdit) return restForbidden('forbidden');
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

export async function deleteInternalBoard(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  if (actor.mustChangePassword) return restForbidden('must_change_password');

  const { id } = await params;
  const board = await getBoardById(id);
  if (!board) return restNotFound('board_not_found');
  if (!canAccessBoard(actor, board)) return restForbidden('forbidden');
  if (!canDeleteBoard(actor, board)) return restForbidden('forbidden');

  try {
    await deleteBoard(id);
    return restOk({ deleted: true });
  } catch (e) {
    if (e.status === 404) return restNotFound('board_not_found');
    throw e;
  }
}
