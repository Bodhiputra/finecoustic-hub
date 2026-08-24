import { BOARD_STATUSES, normalizeDepartmentId } from '@/lib/internal';
import { normalizeBoardProperties } from '@/lib/board-properties';
import { normalizeFlowEdgeDirection } from '@/lib/campaign-flow-utils';

export const DEFAULT_BOARD_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

export const KNOWN_STATUS_LABEL_KEYS = {
  todo: 'hub.internal.statusTodo',
  in_progress: 'hub.internal.statusInProgress',
  in_review: 'hub.internal.statusInReview',
  done: 'hub.internal.statusDone',
  cancelled: 'hub.internal.statusCancelled',
  archived: 'hub.internal.statusArchived',
};

export function slugifyStatusId(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  return s
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function defaultLabelForStatusId(id) {
  if (KNOWN_STATUS_LABEL_KEYS[id]) return '';
  return String(id || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

export function normalizeStatusColumn(item) {
  if (item && typeof item === 'object') {
    const id = slugifyStatusId(item.id || item.label);
    if (!id) return null;
    const label = String(item.label || '').trim().slice(0, 60) || defaultLabelForStatusId(id);
    return { id, label };
  }
  const id = slugifyStatusId(item);
  if (!id) return null;
  return { id, label: defaultLabelForStatusId(id) };
}

export function normalizeStatusColumns(raw) {
  const list = Array.isArray(raw) ? raw : DEFAULT_BOARD_STATUSES;
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const col = normalizeStatusColumn(item);
    if (!col || seen.has(col.id)) continue;
    seen.add(col.id);
    out.push(col);
  }
  return out.length ? out : DEFAULT_BOARD_STATUSES.map(id => normalizeStatusColumn(id));
}

/** Workflow kanbans always include the In Review queue column (assigner notification on drop). */
export function ensureWorkflowStatusColumns(raw) {
  const cols = normalizeStatusColumns(raw);
  const byId = new Map(cols.map(col => [col.id, col]));
  const required = ['todo', 'in_progress', 'in_review', 'done'];
  const optional = cols.filter(col => !required.includes(col.id));
  const merged = required
    .map(id => byId.get(id) || normalizeStatusColumn(id))
    .filter(Boolean);
  for (const col of optional) {
    if (!merged.some(c => c.id === col.id)) merged.push(col);
  }
  return merged;
}

export function isStatusLabelKey(label) {
  const s = String(label || '').trim();
  if (!s) return false;
  return s.startsWith('hub.') || Object.values(KNOWN_STATUS_LABEL_KEYS).includes(s);
}

/** Label shown in editors — resolves stored i18n keys to readable text. */
export function columnEditLabel(column, t) {
  const label = String(column?.label || '').trim();
  if (label && !isStatusLabelKey(label)) return label;
  return statusColumnLabel(column, t);
}

export function statusColumnLabel(column, t) {
  const id = typeof column === 'string' ? column : column?.id;
  let customLabel = typeof column === 'object' ? String(column?.label || '').trim() : '';

  if (customLabel && slugifyStatusId(customLabel) === slugifyStatusId(id)) {
    customLabel = '';
  }

  if (customLabel && !isStatusLabelKey(customLabel)) {
    return customLabel;
  }

  const key = KNOWN_STATUS_LABEL_KEYS[id] || (isStatusLabelKey(customLabel) ? customLabel : null);
  if (key && t) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  if (customLabel) return customLabel;
  return String(id || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

export function statusColumnIds(columns) {
  return normalizeStatusColumns(columns).map(c => c.id);
}

export const EMPTY_FLOW_DATA = { nodes: [], edges: [] };

export function normalizeFlowData(raw) {
  const data = raw && typeof raw === 'object' ? raw : EMPTY_FLOW_DATA;
  const nodes = Array.isArray(data.nodes)
    ? data.nodes
        .map(node => {
          const id = String(node?.id || '').trim();
          if (!id) return null;
          const x = Number(node?.position?.x);
          const y = Number(node?.position?.y);
          const nodeType = ['task', 'milestone', 'kanban'].includes(node?.nodeType)
            ? node.nodeType
            : node?.boardId
              ? 'kanban'
              : 'task';
          return {
            id,
            nodeType,
            taskId: node?.taskId ? String(node.taskId) : null,
            boardId: node?.boardId ? String(node.boardId) : null,
            label: String(node?.label || '').trim().slice(0, 120),
            position: {
              x: Number.isFinite(x) ? x : 0,
              y: Number.isFinite(y) ? y : 0,
            },
          };
        })
        .filter(Boolean)
    : [];
  const edges = Array.isArray(data.edges)
    ? data.edges
        .map(edge => {
          const id = String(edge?.id || '').trim();
          const source = String(edge?.source || '').trim();
          const target = String(edge?.target || '').trim();
          if (!id || !source || !target) return null;
          return { id, source, target };
        })
        .filter(Boolean)
    : [];
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const normalizedEdges = edges.map(edge => normalizeFlowEdgeDirection(edge, nodeById, null));
  return { nodes, edges: normalizedEdges };
}

function flowPositionRank(taskId, taskMeta) {
  const meta = taskMeta.get(taskId);
  if (!meta) return { rank: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER, x: Number.MAX_SAFE_INTEGER };
  return { rank: meta.rank, y: meta.y, x: meta.x };
}

function compareFlowRank(aId, bId, taskMeta) {
  const a = flowPositionRank(aId, taskMeta);
  const b = flowPositionRank(bId, taskMeta);
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

/**
 * Order flow tasks for board/list projections — topological flow order,
 * tie-break by canvas Y then X. Tasks without flow nodes sort last (by title).
 */
export function sortTasksByFlowOrder(tasks, flowData) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!list.length) return [];

  const flow = normalizeFlowData(flowData);
  const taskById = new Map(list.map(task => [task.id, task]));
  const taskMeta = new Map();

  for (const node of flow.nodes) {
    if (!node.taskId || !taskById.has(node.taskId)) continue;
    taskMeta.set(node.taskId, {
      y: node.position?.y ?? 0,
      x: node.position?.x ?? 0,
      nodeId: node.id,
      rank: 0,
    });
  }

  const nodeIdToTaskId = new Map();
  for (const node of flow.nodes) {
    if (node.taskId) nodeIdToTaskId.set(node.id, node.taskId);
  }

  const successors = new Map();
  const inDegree = new Map();
  for (const task of list) {
    inDegree.set(task.id, 0);
    successors.set(task.id, []);
  }

  for (const edge of flow.edges) {
    const fromTask = nodeIdToTaskId.get(edge.source);
    const toTask = nodeIdToTaskId.get(edge.target);
    if (!fromTask || !toTask || fromTask === toTask) continue;
    if (!taskById.has(fromTask) || !taskById.has(toTask)) continue;
    successors.get(fromTask).push(toTask);
    inDegree.set(toTask, (inDegree.get(toTask) || 0) + 1);
  }

  const queue = list
    .filter(task => (inDegree.get(task.id) || 0) === 0)
    .map(task => task.id)
    .sort((a, b) => compareFlowRank(a, b, taskMeta));

  const ordered = [];
  const seen = new Set();

  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const task = taskById.get(id);
    if (task) ordered.push(task);

    const meta = taskMeta.get(id);
    if (meta) meta.rank = ordered.length;

    for (const nextId of successors.get(id) || []) {
      inDegree.set(nextId, (inDegree.get(nextId) || 0) - 1);
      if (inDegree.get(nextId) === 0) {
        queue.push(nextId);
        queue.sort((a, b) => compareFlowRank(a, b, taskMeta));
      }
    }
  }

  const tail = list
    .filter(task => !seen.has(task.id))
    .sort((a, b) => {
      const flowCmp = compareFlowRank(a.id, b.id, taskMeta);
      if (flowCmp !== 0) return flowCmp;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

  return [...ordered, ...tail];
}

export function flowStatusColumns() {
  return ensureWorkflowStatusColumns(BOARD_STATUSES);
}

export function normalizeCampaign(raw) {
  const c = raw || {};
  const now = new Date().toISOString();
  return {
    id: String(c.id || ''),
    department: normalizeDepartmentId(c.department || 'marketing'),
    name: String(c.name || '').trim().slice(0, 120),
    description: String(c.description || '').trim().slice(0, 2000),
    flow_enabled: c.flow_enabled !== false,
    flow_data: normalizeFlowData(c.flow_data),
    sort_order: Number.isFinite(c.sort_order) ? c.sort_order : 0,
    created_by: String(c.created_by || '').trim().slice(0, 80),
    created_at: c.created_at || now,
    updated_at: c.updated_at || c.created_at || now,
  };
}

export function normalizeBoard(raw) {
  const b = raw || {};
  const now = new Date().toISOString();
  return {
    id: String(b.id || ''),
    campaign_id: b.campaign_id ? String(b.campaign_id) : null,
    department: normalizeDepartmentId(b.department || 'marketing'),
    owner_key: String(b.owner_key || '').trim(),
    name: String(b.name || '').trim().slice(0, 120),
    description: String(b.description || '').trim().slice(0, 2000),
    kanban_only: b.kanban_only !== false,
    status_columns: ensureWorkflowStatusColumns(b.status_columns),
    custom_properties: normalizeBoardProperties(b.custom_properties),
    sort_order: Number.isFinite(b.sort_order) ? b.sort_order : 0,
    created_by: String(b.created_by || '').trim().slice(0, 80),
    created_at: b.created_at || now,
    updated_at: b.updated_at || b.created_at || now,
  };
}

/** Board columns for kanban — falls back to hub defaults; always includes In Review queue. */
export function boardStatusColumns(board) {
  if (board?.status_columns?.length) return ensureWorkflowStatusColumns(board.status_columns);
  return ensureWorkflowStatusColumns(BOARD_STATUSES);
}
