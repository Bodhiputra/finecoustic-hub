import { resolveHubActor } from '@/lib/hub-actor';
import { getOpsData } from '@/lib/data';
import { listPreorderSurveyResponses } from '@/lib/preorder-survey';
import { listTasksForActor } from '@/lib/internal-data';
import { getBoardById, getCampaignById, listCampaigns } from '@/lib/internal-campaigns-data';
import { loadProductsForPage } from '@/lib/products-data';
import { getDepartment, departmentTasksEnabled } from '@/lib/internal';
import { isKnowledgeBankTool } from '@/lib/knowledge';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { canAccessDepartment } from '@/lib/hub-departments';
import { internalTasksFilterKey } from '@/lib/internal-tasks-filters';
import { parseInternalBucket } from '@/lib/internal-buckets';

function resolveDepartmentTool(departmentId, { tool = '', boardId = '', flowId = '' } = {}) {
  if (boardId || flowId) return tool;
  if (departmentId === 'marketing' && !tool) return 'campaigns';
  if (departmentId === 'operations' && !tool) return 'dashboard';
  return tool;
}

function departmentNeedsTasks(departmentId, { tool = '', boardId = '', flowId = '' } = {}) {
  if (boardId || flowId) return true;
  if (departmentId === 'all') return true;
  if (departmentId === 'products' || departmentId === 'marketing' || departmentId === 'operations') {
    return false;
  }
  const dept = getDepartment(departmentId);
  if (!dept || !departmentTasksEnabled(dept)) return false;
  if (tool && !isKnowledgeBankTool(tool)) return false;
  return true;
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

  const tasks = await listTasksForActor(actor, {
    department,
    bucket: bucket || undefined,
    board_id: boardId || undefined,
    campaign_id: campaignId || undefined,
    flow_only: flowOnly || undefined,
  });

  const tasksFilterKey = internalTasksFilterKey({
    departmentId,
    viewParam,
    boardId,
    campaignId,
    flowOnly,
  });

  return {
    actor,
    tasks,
    displayName: actor.displayName,
    bucket,
    tasksFilterKey,
  };
}

/** Parallel server load for department pages (tasks + optional ops/survey data). */
export async function loadDepartmentPage({ departmentId, searchParams }) {
  const sp = await searchParams;
  const viewParam = sp?.view || '';
  const boardId = sp?.board || '';
  const flowId = sp?.flow || '';
  const tool = resolveDepartmentTool(departmentId, { tool: sp?.tool || '', boardId, flowId });
  const resolvedSp = { ...sp, tool: tool || sp?.tool || '' };
  const actor = await resolveHubActor();
  const hubMe = hubMeFromActor(actor);

  if (flowId) {
    const [taskBundle, campaign] = await Promise.all([
      loadInternalTasksForPage({ departmentId, viewParam, campaignId: flowId, flowOnly: true, actor }),
      getCampaignById(flowId),
    ]);
    return {
      sp: resolvedSp,
      hubMe,
      tasks: taskBundle.tasks,
      tasksFilterKey: taskBundle.tasksFilterKey,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: campaign || null,
    };
  }

  if (boardId) {
    const [taskBundle, board] = await Promise.all([
      loadInternalTasksForPage({ departmentId, viewParam, boardId, actor }),
      getBoardById(boardId),
    ]);
    return {
      sp: resolvedSp,
      hubMe,
      tasks: taskBundle.tasks,
      tasksFilterKey: taskBundle.tasksFilterKey,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: board || null,
      campaign: null,
    };
  }

  const needsTasks = departmentNeedsTasks(departmentId, { tool, boardId, flowId });
  const tasksPromise = needsTasks
    ? loadInternalTasksForPage({ departmentId, viewParam, actor })
    : Promise.resolve({ tasks: [] });

  if (departmentId === 'operations') {
    const opsData = await getOpsData();
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      opsData,
      marketingRows: [],
      campaigns: [],
      board: null,
      campaign: null,
    };
  }

  if (departmentId === 'marketing' && tool === 'preorder-survey') {
    const marketingRows = await listPreorderSurveyResponses({ limit: 500 });
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
      opsData: null,
      marketingRows,
      campaigns: [],
      board: null,
      campaign: null,
    };
  }

  if (departmentId === 'marketing' && tool === 'campaigns') {
    const campaigns = await listCampaigns({ department: departmentId });
    return {
      sp: resolvedSp,
      hubMe,
      tasks: [],
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
    const { products, productDetail } = canProducts
      ? await loadProductsForPage(actor, productSku)
      : { products: [], productDetail: null };
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

  const taskBundle = await tasksPromise;
  return {
    sp: resolvedSp,
    hubMe,
    tasks: taskBundle.tasks,
    tasksFilterKey: needsTasks ? taskBundle.tasksFilterKey : null,
    opsData: null,
    marketingRows: [],
    campaigns: [],
    board: null,
    campaign: null,
    products: [],
    productDetail: null,
  };
}
