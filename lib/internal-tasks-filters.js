import { parseInternalBucket } from '@/lib/internal-buckets';

/** Query params for GET /api/v1/internal/tasks — must match server `loadInternalTasksForPage`. */
export function resolveInternalTasksQuery({
  departmentId = '',
  viewParam = '',
  boardId = '',
  campaignId = '',
  flowOnly = false,
} = {}) {
  return {
    department: departmentId && departmentId !== 'all' ? departmentId : '',
    bucket: parseInternalBucket(viewParam) || '',
    boardId: boardId || '',
    campaignId: campaignId || '',
    flowOnly: Boolean(flowOnly),
  };
}

export function internalTasksFilterKey(params) {
  const q = resolveInternalTasksQuery(params);
  return `${q.department}|${q.bucket}|${q.boardId}|${q.campaignId}|${q.flowOnly ? '1' : '0'}`;
}

export function tasksListSeedKey(list) {
  if (!Array.isArray(list)) return '__none__';
  if (!list.length) return '__empty__';
  return list.map(task => `${task.id}:${task.updated_at || ''}:${task.status || ''}`).join('|');
}
