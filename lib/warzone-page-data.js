import { resolveHubActor } from '@/lib/hub-actor';
import { getOpsData } from '@/lib/data';
import { listPreorderSurveyResponses } from '@/lib/preorder-survey';
import { listTasksForActor } from '@/lib/warzone-data';

const BUCKET_VIEWS = new Set(['today', 'overdue', 'in_progress', 'bank', 'milestones']);

export function parseWarzoneBucket(viewParam = '') {
  return BUCKET_VIEWS.has(viewParam) ? viewParam : '';
}

/** Server-side task payload for Warzone pages — avoids client fetch on first paint. */
export async function loadWarzoneTasksForPage({
  departmentId = '',
  viewParam = '',
} = {}) {
  const actor = await resolveHubActor();
  if (!actor.ok) {
    return { actor, tasks: [] };
  }

  const department = departmentId && departmentId !== 'all' ? departmentId : undefined;
  const bucket = parseWarzoneBucket(viewParam);

  const tasks = await listTasksForActor(actor, { department, bucket: bucket || undefined });

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

  const tasksPromise = loadWarzoneTasksForPage({ departmentId, viewParam });

  if (departmentId === 'operations') {
    const [opsData, taskBundle] = await Promise.all([getOpsData(), tasksPromise]);
    return { sp, tasks: taskBundle.tasks, opsData, marketingRows: [] };
  }

  if (departmentId === 'marketing' && tool === 'preorder-survey') {
    const [taskBundle, marketingRows] = await Promise.all([
      tasksPromise,
      listPreorderSurveyResponses({ limit: 500 }),
    ]);
    return { sp, tasks: taskBundle.tasks, opsData: null, marketingRows };
  }

  const taskBundle = await tasksPromise;
  return { sp, tasks: taskBundle.tasks, opsData: null, marketingRows: [] };
}
