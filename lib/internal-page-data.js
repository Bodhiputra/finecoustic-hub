import { resolveHubActor } from '@/lib/hub-actor';
import { getOpsData } from '@/lib/data';
import { isShopifyInventoryConfigured } from '@/lib/shopify-inventory';
import { readShopifySnapshot } from '@/lib/shopify-snapshot';
import { listTasksForActor } from '@/lib/internal-data';
import { getBoardById, getCampaignById, listCampaignsForList, canAccessBoard } from '@/lib/internal-campaigns-data';
import { loadProductsForPage } from '@/lib/products-data';
import { CAMPAIGNS_ID, PERSONAL_DEPARTMENT_ID } from '@/lib/internal';
import { listPagesForDepartment } from '@/lib/knowledge-data';
import { FINEACOUSTIC_WIKI_DEPARTMENT } from '@/lib/knowledge';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { canAccessDepartment } from '@/lib/hub-departments';
import {
  loadMarketingKolOutreachPage,
  loadMarketingKolPoolPage,
  loadMarketingPreorderSurveyPage,
} from '@/lib/page-loaders/marketing';
import { loadPersonalSidebarBoards } from '@/lib/page-loaders/sidebar';
import { loadHubTeamMembers } from '@/lib/page-loaders/hub-shell';
import { listExpenses } from '@/lib/hub-expenses';
import { listPersonalJotsForOwner } from '@/lib/personal-jots-data';
import { PERSONAL_JOT_DOWN_TOOL } from '@/lib/personal-jots-shared';
import { isJotDownTool } from '@/lib/knowledge';
import { personKey } from '@/lib/appdev';
import { internalTasksFilterKey } from '@/lib/internal-tasks-filters';
import { parseInternalBucket } from '@/lib/internal-buckets';

function resolveDepartmentTool(departmentId, { tool = '', boardId = '', flowId = '' } = {}) {
  if (boardId || flowId) return tool;
  if (departmentId === PERSONAL_DEPARTMENT_ID) return tool;
  if (departmentId === 'marketing' && !tool) return 'kol-pool';
  if (departmentId === 'operations' && !tool) return 'dashboard';
  return tool;
}

function departmentNeedsTasks(departmentId, { tool = '', boardId = '', flowId = '' } = {}) {
  if (boardId || flowId) return true;
  if (tool === PERSONAL_JOT_DOWN_TOOL) return false;
  if (isJotDownTool(tool)) return false;
  if (departmentId === PERSONAL_DEPARTMENT_ID) return true;
  if (departmentId === 'all') return true;
  return false;
}

export { parseInternalBucket } from '@/lib/internal-buckets';

/** Server-side task payload for Internal pages — avoids client fetch on first paint. */
export async function loadInternalTasksForPage({
  departmentId = '',
  viewParam = '',
  boardId = '',
  campaignId = '',
  flowOnly = false,
  actor: actorIn = null,
} = {}) {
  const actor = actorIn?.ok ? actorIn : await resolveHubActor();
  if (!actor.ok) {
    return { actor, tasks: [] };
  }

  const department = departmentId && departmentId !== 'all' ? departmentId : undefined;
  const bucket = parseInternalBucket(viewParam);
  const hubHome = !departmentId && !boardId && !campaignId;

  const tasksFilterKey = internalTasksFilterKey({
    departmentId,
    viewParam,
    boardId,
    campaignId,
    flowOnly,
  });

  try {
    const tasks = await listTasksForActor(actor, {
      department,
      bucket: bucket || undefined,
      board_id: boardId || undefined,
      campaign_id: campaignId || undefined,
      flow_only: flowOnly || undefined,
      hub_home: hubHome || undefined,
    });

    return {
      actor,
      tasks,
      displayName: actor.displayName,
      bucket,
      tasksFilterKey,
    };
  } catch (err) {
    console.error('[loadInternalTasksForPage]', err);
    return {
      actor,
      tasks: [],
      displayName: actor.displayName,
      bucket,
      tasksFilterKey,
      loadError: 'tasks_unavailable',
    };
  }
}

/** Server load for hub home — calendar tasks + profile (tabs are client-side via searchParams). */
export async function loadHomePageData() {
  const actor = await resolveHubActor();
  if (!actor.ok) {
    return {
      displayName: '',
      initialProfile: null,
      tasks: [],
      tasksFilterKey: null,
      teamMembers: [],
      initialCampaigns: [],
      initialWikiPages: [],
    };
  }

  const initialProfile = hubMeFromActor(actor);
  const displayName = actor.displayName || '';

  const [loaded, teamMembers, initialCampaigns, initialWikiPages] = await Promise.all([
    loadInternalTasksForPage({ actor }),
    loadHubTeamMembers(),
    listCampaignsForList().catch(err => {
      console.error('[loadHomePageData] campaigns', err);
      return [];
    }),
    listPagesForDepartment(FINEACOUSTIC_WIKI_DEPARTMENT).catch(err => {
      console.error('[loadHomePageData] wiki pages', err);
      return [];
    }),
  ]);
  return {
    displayName: loaded.displayName || displayName,
    initialProfile,
    tasks: loaded.tasks,
    tasksFilterKey: loaded.tasksFilterKey,
    tasksLoadError: loaded.loadError || null,
    teamMembers,
    initialCampaigns,
    initialWikiPages,
  };
}

/** Parallel server load for department pages (tasks + optional ops/survey data). */
export async function loadDepartmentPage({ departmentId, searchParams, fixedTool = '', actor: actorIn = null }) {
  const sp = await searchParams;
  const viewParam = sp?.view || '';
  const boardId = sp?.board || '';
  const flowId = sp?.flow || '';
  const tool = fixedTool || resolveDepartmentTool(departmentId, { tool: sp?.tool || '', boardId, flowId });
  const resolvedSp = { ...sp, tool: tool || sp?.tool || '' };
  const actor = actorIn?.ok ? actorIn : await resolveHubActor();
  const hubMe = hubMeFromActor(actor);

  if (departmentId === PERSONAL_DEPARTMENT_ID && tool === PERSONAL_JOT_DOWN_TOOL) {
    let personalJots = [];
    try {
      if (actor.ok) {
        personalJots = await listPersonalJotsForOwner(personKey(actor.displayName));
      }
    } catch (err) {
      console.error('[loadDepartmentPage] personal-jots', err);
    }
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      tasksFilterKey: null,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
      personalJots,
    };
  }

  if (departmentId !== PERSONAL_DEPARTMENT_ID && departmentId !== 'all' && isJotDownTool(tool)) {
    let departmentJots = [];
    try {
      if (actor.ok && canAccessDepartment(actor, departmentId)) {
        departmentJots = await listPagesForDepartment(departmentId);
      }
    } catch (err) {
      console.error('[loadDepartmentPage] department-jots', err);
    }
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      tasksFilterKey: null,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
      departmentJots,
    };
  }

  if (flowId) {
    let campaign = null;
    try {
      campaign = await getCampaignById(flowId);
    } catch (err) {
      console.error('[loadDepartmentPage] getCampaignById', err);
    }
    const taskBundle = await loadInternalTasksForPage({
      departmentId,
      viewParam,
      campaignId: flowId,
      flowOnly: true,
      actor,
    });
    return {
      sp: resolvedSp,
      hubMe,
      tasks: taskBundle.tasks,
      tasksFilterKey: taskBundle.tasksFilterKey,
      tasksLoadError: taskBundle.loadError || null,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: campaign || null,
    };
  }

  if (boardId) {
    let board = null;
    try {
      board = await getBoardById(boardId);
      if (board && actor.ok && !canAccessBoard(actor, board)) board = null;
    } catch (err) {
      console.error('[loadDepartmentPage] getBoardById', err);
    }
    const taskBundle = await loadInternalTasksForPage({ departmentId, viewParam, boardId, actor });
    return {
      sp: resolvedSp,
      hubMe,
      tasks: taskBundle.tasks,
      tasksFilterKey: taskBundle.tasksFilterKey,
      tasksLoadError: taskBundle.loadError || null,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: board || null,
      campaign: null,
    };
  }

  if (departmentId === 'finecoustic') {
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      tasksFilterKey: null,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
      kolPool: null,
    };
  }

  if (departmentId === 'operations') {
    let opsData = null;
    let expenses = [];
    const needsOpsData = tool !== 'expenses';
    try {
      if (needsOpsData) opsData = await getOpsData();
      if (tool === 'expenses') expenses = await listExpenses();
    } catch (err) {
      console.error('[loadDepartmentPage] operations', err);
    }
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      opsData,
      expenses,
      shopifyConfigured: isShopifyInventoryConfigured(),
      shopifySnapshot: readShopifySnapshot(),
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
    };
  }

  if (departmentId === 'marketing' && tool === 'preorder-survey') {
    const { marketingRows } = await loadMarketingPreorderSurveyPage();
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      opsData: null,
      marketingRows,
      campaigns: [],
      board: null,
      campaign: null,
      kolPool: null,
    };
  }

  if (departmentId === 'marketing' && tool === 'kol-pool') {
    const canMarketing = actor.ok && canAccessDepartment(actor, 'marketing');
    let kolPool = { records: [], meta: null, counts: {}, configured: false, total: 0 };
    if (canMarketing) {
      const loaded = await loadMarketingKolPoolPage(actor);
      kolPool = loaded.kolPool;
    }
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
      kolPool,
    };
  }

  if (departmentId === 'marketing' && tool === 'kol-outreach') {
    const canMarketing = actor.ok && canAccessDepartment(actor, 'marketing');
    let tasks = [];
    let tasksFilterKey = null;
    let tasksLoadError = null;
    let kolPool = { records: [], meta: null, counts: {}, configured: false, total: 0 };
    if (canMarketing) {
      const loaded = await loadMarketingKolOutreachPage(actor);
      tasks = loaded.tasks;
      tasksFilterKey = loaded.tasksFilterKey;
      tasksLoadError = loaded.tasksLoadError;
      kolPool = loaded.kolPool;
    }
    return {
      sp: resolvedSp,
      hubMe,
      tasks,
      tasksFilterKey,
      tasksLoadError,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
      kolPool,
    };
  }

  if (departmentId === CAMPAIGNS_ID) {
    let campaigns = [];
    try {
      campaigns = await listCampaignsForList();
    } catch (err) {
      console.error('[loadDepartmentPage] campaigns', err);
    }
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      tasksFilterKey: null,
      opsData: null,
      marketingRows: [],
      campaigns,
      board: null,
      campaign: null,
      products: [],
      productDetail: null,
    };
  }

  if (departmentId === 'products') {
    const canProducts = actor.ok && canAccessDepartment(actor, 'products');
    const productSku = String(sp?.product || '').trim().toUpperCase();
    let products = [];
    let productDetail = null;
    if (canProducts) {
      try {
        ({ products, productDetail } = await loadProductsForPage(actor, productSku));
      } catch (err) {
        console.error('[loadDepartmentPage] products', err);
      }
    }
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
      products,
      productDetail,
    };
  }

  if (!departmentNeedsTasks(departmentId, { tool, boardId, flowId })) {
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      tasksFilterKey: null,
      tasksLoadError: null,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
      products: [],
      productDetail: null,
    };
  }

  const taskBundle = await loadInternalTasksForPage({ departmentId, viewParam, actor });
  return {
    sp: resolvedSp,
    hubMe,
    tasks: taskBundle.tasks,
    tasksFilterKey: taskBundle.tasksFilterKey,
    tasksLoadError: taskBundle.loadError || null,
    opsData: null,
    marketingRows: [],
    campaigns: [],
    board: null,
    campaign: null,
    products: [],
    productDetail: null,
  };
}

/** Personal /me — preload assigned tasks + jot-down notes in one pass (layout stays mounted on tab change). */
export async function loadPersonalWorkspaceData() {
  const actor = await resolveHubActor();
  const hubMe = hubMeFromActor(actor);

  if (!actor.ok) {
    return {
      hubMe,
      tasks: [],
      tasksFilterKey: null,
      tasksLoadError: null,
      personalJots: [],
    };
  }

  const ownerKey = personKey(actor.displayName);

  try {
    const [taskBundle, personalJots, personalBoards, teamMembers] = await Promise.all([
      loadInternalTasksForPage({ departmentId: PERSONAL_DEPARTMENT_ID, actor }),
      listPersonalJotsForOwner(ownerKey),
      loadPersonalSidebarBoards(actor),
      loadHubTeamMembers(),
    ]);

    return {
      hubMe,
      tasks: taskBundle.tasks,
      tasksFilterKey: taskBundle.tasksFilterKey,
      tasksLoadError: taskBundle.loadError || null,
      personalJots,
      personalBoards,
      teamMembers,
    };
  } catch (err) {
    console.error('[loadPersonalWorkspaceData]', err);
    return {
      hubMe,
      tasks: [],
      tasksFilterKey: null,
      tasksLoadError: 'tasks_unavailable',
      personalJots: [],
      personalBoards: [],
    };
  }
}
