/** Append a task/milestone row to campaign flow_data (canvas layout). */
export function appendTaskNodeToFlow(flowData, task) {
  const data = flowData || { nodes: [], edges: [] };
  if (!task?.id) return data;
  if (data.nodes?.some(node => node.taskId === task.id)) return data;
  const y = (data.nodes?.length || 0) * 96;
  const nodeType = task.kind === 'milestone' ? 'milestone' : 'task';
  return {
    nodes: [
      ...(data.nodes || []),
      {
        id: `node-${task.id}`,
        taskId: task.id,
        nodeType,
        label: task.title || 'Untitled',
        position: { x: 160, y },
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

/** Append a kanban board node to campaign flow_data. */
export function appendKanbanNodeToFlow(flowData, board, label = '') {
  const data = flowData || { nodes: [], edges: [] };
  if (!board?.id) return data;
  if (data.nodes?.some(node => node.boardId === board.id)) return data;
  const y = (data.nodes?.length || 0) * 96;
  return {
    nodes: [
      ...(data.nodes || []),
      {
        id: `kanban-${board.id}`,
        nodeType: 'kanban',
        boardId: board.id,
        label: label || board.name || 'Kanban',
        position: { x: 240, y },
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
