/** Default canvas position for a new flow node. */
export function defaultFlowNodePosition(flowData, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x, y };
  }
  const fallbackY = (flowData?.nodes?.length || 0) * 96;
  return { x: 160, y: fallbackY };
}

/** Append a task/milestone row to campaign flow_data (canvas layout). */
export function appendTaskNodeToFlow(flowData, task, position) {
  const data = flowData || { nodes: [], edges: [] };
  if (!task?.id) return data;
  if (data.nodes?.some(node => node.taskId === task.id)) return data;
  const nodeType = task.kind === 'milestone' ? 'milestone' : 'task';
  return {
    nodes: [
      ...(data.nodes || []),
      {
        id: `node-${task.id}`,
        taskId: task.id,
        nodeType,
        label: task.title || 'Untitled',
        position: defaultFlowNodePosition(data, position),
      },
    ],
    edges: data.edges || [],
  };
}

/** Board ids already represented as kanban nodes on the flow canvas. */
export function getBoardIdsOnFlow(flowData) {
  const ids = new Set();
  for (const node of flowData?.nodes || []) {
    if (node?.boardId) ids.add(node.boardId);
  }
  return ids;
}

/** Campaign boards not yet placed on the flow map. */
export function getBoardsNotOnFlow(boards, flowData) {
  const onFlow = getBoardIdsOnFlow(flowData);
  return (boards || []).filter(board => board?.id && !onFlow.has(board.id));
}

/** Dedupe boards by id (first wins). */
export function mergeBoardsUnique(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const board of list || []) {
      if (board?.id) byId.set(board.id, board);
    }
  }
  return [...byId.values()];
}

/** Department + campaign boards eligible to add to a flow canvas. */
export function getFlowKanbanPickerBoards(campaignBoards, departmentBoards, flowData) {
  return getBoardsNotOnFlow(mergeBoardsUnique(campaignBoards, departmentBoards), flowData);
}

/** Milestone/meeting status keys — stored as todo/done/cancelled, labeled for calendar/flow UI. */
export const MILESTONE_FLOW_STATUS_KEYS = {
  todo: 'hub.internal.taskPanel.milestoneScheduled',
  done: 'hub.internal.taskPanel.milestoneCompleted',
  cancelled: 'hub.internal.taskPanel.milestoneCancelled',
};

export function isCalendarFlowNodeKind(kind) {
  return kind === 'milestone' || kind === 'meeting';
}

/** Resolve node kind from React Flow node or persisted flow_data node. */
export function getFlowNodeKind(node, taskById) {
  if (!node) return 'task';
  const data = node.data || node;
  if (data.nodeType === 'kanban' || data.boardId || node.boardId) return 'kanban';
  if (data.nodeType === 'milestone' || node.nodeType === 'milestone') return 'milestone';
  if (data.nodeType === 'meeting' || node.nodeType === 'meeting') return 'meeting';
  const taskId = data.taskId || node.taskId;
  const task = taskId && taskById?.get?.(taskId);
  if (task?.kind) return task.kind;
  return data.nodeType || node.nodeType || 'task';
}

function sideFromHandle(handle, fallback = 'bottom') {
  const id = String(handle || '');
  const match = id.match(/(?:source|target)-(.+)$/);
  return match?.[1] || fallback;
}

const FLOW_EDGE_HANDLES = new Set([
  'source-top',
  'source-bottom',
  'source-left',
  'source-right',
  'target-top',
  'target-bottom',
  'target-left',
  'target-right',
]);

/** Keep only valid React Flow handle ids for persisted flow_data edges. */
export function sanitizeFlowEdgeHandle(handle, kind) {
  const id = String(handle || '').trim();
  if (!FLOW_EDGE_HANDLES.has(id)) return undefined;
  if (kind === 'source' && !id.startsWith('source-')) return undefined;
  if (kind === 'target' && !id.startsWith('target-')) return undefined;
  return id;
}

function toSourceHandle(handle, fallbackSide = 'bottom') {
  return `source-${sideFromHandle(handle, fallbackSide)}`;
}

function toTargetHandle(handle, fallbackSide = 'top') {
  return `target-${sideFromHandle(handle, fallbackSide)}`;
}

/** Flip edge ends while keeping the same sides (top/top, bottom/bottom, etc.). */
export function flipFlowEdge(edge) {
  return {
    ...edge,
    source: edge.target,
    target: edge.source,
    sourceHandle: toSourceHandle(edge.targetHandle, sideFromHandle(edge.sourceHandle, 'bottom')),
    targetHandle: toTargetHandle(edge.sourceHandle, sideFromHandle(edge.targetHandle, 'top')),
  };
}

/** Work flows bottom-up into milestones — milestone/meeting is always the arrow target. */
export function normalizeFlowEdgeDirection(edge, nodeById, taskById) {
  const sourceNode = nodeById.get(edge.source);
  const targetNode = nodeById.get(edge.target);
  if (!sourceNode || !targetNode) return edge;

  const sourceKind = getFlowNodeKind(sourceNode, taskById);
  const targetKind = getFlowNodeKind(targetNode, taskById);
  if (sourceKind === 'kanban' || targetKind === 'kanban') return edge;

  if (isCalendarFlowNodeKind(sourceKind) && !isCalendarFlowNodeKind(targetKind)) {
    return flipFlowEdge(edge);
  }

  return edge;
}

/** Human label for a flow canvas node badge. */
export function flowNodeStatusLabel(status, kind, t, workflowColumns, statusColumnLabelFn) {
  if (isCalendarFlowNodeKind(kind) && MILESTONE_FLOW_STATUS_KEYS[status]) {
    return t(MILESTONE_FLOW_STATUS_KEYS[status]);
  }
  const col = workflowColumns?.find(c => (typeof c === 'string' ? c : c.id) === status);
  if (col && statusColumnLabelFn) return statusColumnLabelFn(col, t);
  return status;
}

/** CSS modifier for flow node status pill (milestones use scheduled, not todo). */
export function flowNodeStatusClass(status, kind) {
  if (isCalendarFlowNodeKind(kind)) {
    if (status === 'todo') return 'scheduled';
    if (status === 'done') return 'completed';
    if (status === 'cancelled') return 'cancelled';
  }
  return status;
}

/** Append a kanban board node to campaign flow_data. */
export function appendKanbanNodeToFlow(flowData, board, label = '', position) {
  const data = flowData || { nodes: [], edges: [] };
  if (!board?.id) return data;
  if (data.nodes?.some(node => node.boardId === board.id)) return data;
  return {
    nodes: [
      ...(data.nodes || []),
      {
        id: `kanban-${board.id}`,
        nodeType: 'kanban',
        boardId: board.id,
        label: label || board.name || 'Kanban',
        position: defaultFlowNodePosition(data, position),
      },
    ],
    edges: data.edges || [],
  };
}

/** Keep kanban node labels in sync when a board is renamed. */
export function syncBoardNameInFlow(flowData, boardId, name) {
  const data = flowData || { nodes: [], edges: [] };
  const label = String(name || '').trim();
  if (!boardId || !label) return data;

  let changed = false;
  const nodes = (data.nodes || []).map(node => {
    if (node?.boardId !== boardId && node?.id !== `kanban-${boardId}`) return node;
    if (node.label === label) return node;
    changed = true;
    return { ...node, label };
  });

  return changed ? { ...data, nodes } : data;
}

/** Task/board ids referenced on the flow canvas (ignores layout positions). */
export function flowCanvasTaskIds(flowData) {
  const ids = new Set();
  for (const node of flowData?.nodes || []) {
    if (node?.taskId) ids.add(String(node.taskId));
  }
  return ids;
}

/** Stable key for flow topology — node/edge ids only, not positions (avoids rebuild on drag-save). */
export function flowStructureKey(flowData, boards = []) {
  const nodes = flowData?.nodes || [];
  const edges = flowData?.edges || [];
  const nodeKey = nodes
    .map(node => `${node.id}:${node.taskId || ''}:${node.boardId || ''}:${node.nodeType || ''}`)
    .sort()
    .join(',');
  const edgeKey = edges
    .map(edge =>
      `${edge.id}:${edge.source}->${edge.target}:${edge.sourceHandle || ''}:${edge.targetHandle || ''}`
    )
    .sort()
    .join(',');
  const boardKey = (boards || [])
    .map(board => `${board.id}:${board.name || ''}`)
    .sort()
    .join(',');
  return `${nodeKey}|${edgeKey}|${boardKey}`;
}

/** Compact sync key for task fields shown on flow nodes. */
export function flowCanvasTaskSyncKey(tasks, flowData) {
  const ids = flowCanvasTaskIds(flowData);
  if (!ids.size) return '';
  return (tasks || [])
    .filter(task => ids.has(task.id))
    .map(task => `${task.id}:${task.title}:${task.status}:${task.kind}`)
    .sort()
    .join(',');
}

function collectReachable(startId, adjacency, nodeKind, direction) {
  const seen = new Set();
  const stack = [...(adjacency.get(startId) || [])];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    if (direction === 'incoming' && isCalendarFlowNodeKind(nodeKind(id))) continue;
    if (direction === 'outgoing' && isCalendarFlowNodeKind(nodeKind(id))) continue;
    seen.add(id);
    stack.push(...(adjacency.get(id) || []));
  }
  return seen;
}

/**
 * Nodes that should move with a dragged node.
 * - Milestone sink with task sources below: upstream tasks follow.
 * - Task root with outgoing edges: downstream targets follow.
 * Milestone-to-milestone chains drag individually (no auto-group).
 */
export function getFlowDragFollowers(nodeId, edges = [], nodes = []) {
  const nodeById = new Map((nodes || []).map(node => [node.id, node]));
  const nodeKind = id => {
    const node = nodeById.get(id);
    const data = node?.data || {};
    return data.nodeType || data.kind || 'task';
  };

  const incoming = new Map();
  const outgoing = new Map();
  for (const edge of edges) {
    if (!edge?.source || !edge?.target) continue;
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target).push(edge.source);
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source).push(edge.target);
  }

  const inCount = (incoming.get(nodeId) || []).length;
  const outCount = (outgoing.get(nodeId) || []).length;
  const draggedKind = nodeKind(nodeId);

  if (inCount > 0 && outCount === 0) {
    const sources = incoming.get(nodeId) || [];
    const hasNonMilestoneSource = sources.some(id => !isCalendarFlowNodeKind(nodeKind(id)));
    if (!hasNonMilestoneSource) return new Set();
    return collectReachable(nodeId, incoming, nodeKind, 'incoming');
  }
  if (inCount === 0 && outCount > 0 && !isCalendarFlowNodeKind(draggedKind)) {
    return collectReachable(nodeId, outgoing, nodeKind, 'outgoing');
  }
  return new Set();
}
