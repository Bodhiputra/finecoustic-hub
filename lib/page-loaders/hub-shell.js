import { listActiveTeamMemberNames } from '@/lib/hub-users';
import { isHubAuthEnabled } from '@/lib/auth';
import { resolveHubActor } from '@/lib/hub-actor';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { departmentKanbansEnabled, PERSONAL_DEPARTMENT_ID } from '@/lib/internal';

/** One auth resolve per request — shared by hub layout + pages via React cache on resolveHubActor. */
export async function loadHubSession() {
  if (!isHubAuthEnabled()) {
    return { authEnabled: false, initialProfile: null };
  }
  const actor = await resolveHubActor();
  return {
    authEnabled: true,
    initialProfile: actor.ok ? hubMeFromActor(actor) : null,
  };
}

/** Active hub display names for assignee pickers — server-seeded to skip client probe. */
export async function loadHubTeamMembers() {
  try {
    return await listActiveTeamMemberNames();
  } catch (err) {
    console.error('[loadHubTeamMembers]', err);
    return [];
  }
}

/** Skip expensive sidebar/user loads on data-tool pages that do not need them. */
export async function resolveDepartmentLoaderScope(departmentId, searchParams, fixedTool = '') {
  const sp = searchParams?.then ? await searchParams : searchParams || {};
  const boardId = sp?.board || '';
  const flowId = sp?.flow || '';
  const tool = fixedTool || sp?.tool || '';

  const marketingDataTool =
    departmentId === 'marketing'
    && ['kol-pool', 'kol-outreach', 'preorder-survey'].includes(tool);

  const opsToolView =
    departmentId === 'operations'
    && Boolean(tool)
    && !boardId
    && !flowId;

  const productsView =
    departmentId === 'products'
    && !boardId
    && !flowId;

  const needsSidebarBoards =
    departmentKanbansEnabled(departmentId)
    && !marketingDataTool
    && !boardId
    && !flowId;

  const needsTeamMembers = Boolean(
    boardId
    || flowId
    || departmentId === 'all'
    || departmentId === PERSONAL_DEPARTMENT_ID
    || departmentId === 'creatives'
    || (departmentId === 'marketing' && tool === 'kol-outreach')
  ) && !opsToolView && !productsView && !(marketingDataTool && tool !== 'kol-outreach');

  return { needsSidebarBoards, needsTeamMembers };
}
