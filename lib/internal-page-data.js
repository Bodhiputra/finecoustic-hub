import { resolveHubActor } from '@/lib/hub-actor';
import { getOpsData } from '@/lib/data';
import { listPreorderSurveyResponses } from '@/lib/preorder-survey';
import { listTasksForActor } from '@/lib/internal-data';
import { getBoardById, listCampaigns } from '@/lib/internal-campaigns-data';

const BUCKET_VIEWS = new Set(['today', 'overdue', 'in_progress', 'bank', 'milestones']);

export function parseInternalBucket(viewParam = '') {
  return BUCKET_VIEWS.has(viewParam) ? viewParam : '';
}

/** Server-side task payload for Internal pages — avoids client fetch on first paint. */
export async function loadInternalTasksForPage({
  departmentId = '',
  viewParam = '',
  boardId = '',
} = {}) {
  const actor = await resolveHubActor();
  if (!actor.ok) {
    return { actor, tasks: [] };
  }

  const department = departmentId && departmentId !== 'all' ? departmentId : undefined;
  const bucket = parseInternalBucket(viewParam);

  const tasks = await listTasksForActor(actor, {
    department,
    bucket: bucket || undefined,
    board_id: boardId || undefined,
  });

  return {
    actor,
    tasks,
    displayName: actor.displayName,
    bucket,
  };
}

/** Parallel server load for department pages (tasks + optional ops/survey data). */
export async function loadDepartmentPage({ departmentId, searchParams }) {
  const sp = await searchParams;
  const viewParam = sp?.view || '';
  const tool = sp?.tool || '';
  const boardId = sp?.board || '';

  if (boardId) {
    const [taskBundle, board] = await Promise.all([
      loadInternalTasksForPage({ departmentId, viewParam, boardId }),
      getBoardById(boardId),
    ]);
    return {
      sp,
      tasks: taskBundle.tasks,
      opsData: null,
      marketingRows: [],
      campaigns: [],
      board: board || null,
    };
  }

  const tasksPromise = loadInternalTasksForPage({ departmentId, viewParam });

  if (departmentId === 'operations') {
    const [opsData, taskBundle] = await Promise.all([getOpsData(), tasksPromise]);
    return { sp, tasks: taskBundle.tasks, opsData, marketingRows: [], campaigns: [], board: null };
  }

  if (departmentId === 'marketing' && tool === 'preorder-survey') {
    const [taskBundle, marketingRows] = await Promise.all([
      tasksPromise,
      listPreorderSurveyResponses({ limit: 500 }),
    ]);
    return { sp, tasks: taskBundle.tasks, opsData: null, marketingRows, campaigns: [], board: null };
  }

  if (departmentId === 'marketing' && tool === 'campaigns') {
    const [taskBundle, campaigns] = await Promise.all([
      tasksPromise,
      listCampaigns({ department: departmentId }),
    ]);
    return { sp, tasks: taskBundle.tasks, opsData: null, marketingRows: [], campaigns, board: null };
  }

  const taskBundle = await tasksPromise;
  return { sp, tasks: taskBundle.tasks, opsData: null, marketingRows: [], campaigns: [], board: null };
}
