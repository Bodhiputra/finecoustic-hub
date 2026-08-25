'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { flowCanvasTaskIds, flowNodeStatusClass, flowNodeStatusLabel, flowCanvasTaskSyncKey, flowStructureKey, normalizeFlowEdgeDirection } from '@/lib/campaign-flow-utils';

const SAVE_DEBOUNCE_MS = 400;
const FLOW_BG_NODE_LIMIT = 35;
const ARROW_MARKER = { type: MarkerType.ArrowClosed };
const DEFAULT_EDGE_OPTIONS = { type: 'smoothstep', markerEnd: ARROW_MARKER };

function newEdgeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `edge-${Date.now()}`;
}

function flowNodeDataEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.label === b.label
    && a.status === b.status
    && a.statusClass === b.statusClass
    && a.statusLabel === b.statusLabel
    && a.kind === b.kind
    && a.nodeType === b.nodeType
    && a.taskId === b.taskId
    && a.boardId === b.boardId
  );
}

const FlowNode = memo(function FlowNode({ data, selected }) {
  const isMilestone = data.nodeType === 'milestone' || data.kind === 'milestone';
  const isKanban = data.nodeType === 'kanban';
  const typeClass = isKanban ? ' is-kanban' : isMilestone ? ' is-milestone' : ' is-task';
  const typeLabel = isKanban ? 'Kanban board' : isMilestone ? 'Milestone' : 'Task';

  return (
    <div
      className={`campaign-flow-node${typeClass}${selected ? ' is-selected' : ''}`}
      aria-label={`${typeLabel}: ${data.label || 'Untitled'}`}
    >
      <Handle id="target-top" type="target" position={Position.Top} />
      <Handle id="target-left" type="target" position={Position.Left} />
      <div className="campaign-flow-node-meta">
        <span className="campaign-flow-node-type-icon" aria-hidden="true">
          {isKanban ? '▦' : isMilestone ? '◇' : '□'}
        </span>
        {!isKanban && data.status ? (
          <span className={`campaign-flow-node-status is-${data.statusClass || data.status}`}>
            {data.statusLabel || data.status}
          </span>
        ) : null}
      </div>
      <span className="campaign-flow-node-label">{data.label}</span>
      {isKanban ? <span className="campaign-flow-node-hint">Open board →</span> : null}
      <Handle id="source-bottom" type="source" position={Position.Bottom} />
      <Handle id="source-right" type="source" position={Position.Right} />
    </div>
  );
}, (prev, next) => prev.selected === next.selected && flowNodeDataEqual(prev.data, next.data));

const nodeTypes = { flowNode: FlowNode };

function useHubColorMode() {
  const [colorMode, setColorMode] = useState('dark');

  useEffect(() => {
    const sync = () => {
      setColorMode(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return colorMode;
}

function buildFlowGraph(flowData, tasks, boards = [], statusLabelFor) {
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const boardById = new Map((boards || []).map(board => [board.id, board]));
  const nodes = (flowData?.nodes || [])
    .filter(node => node.taskId || node.boardId || node.nodeType === 'kanban')
    .map(node => {
      const nodeType = node.nodeType || (node.boardId ? 'kanban' : 'task');
      if (nodeType === 'kanban' || node.boardId) {
        const board = boardById.get(node.boardId);
        return {
          id: node.id,
          type: 'flowNode',
          position: node.position || { x: 0, y: 0 },
          data: {
            nodeType: 'kanban',
            boardId: node.boardId,
            label: board?.name || node.label || 'Kanban',
          },
        };
      }
      const task = taskById.get(node.taskId);
      const label = task?.title || node.label || 'Untitled';
      const kind = task?.kind || nodeType || 'task';
      const status = task?.status || 'todo';
      return {
        id: node.id,
        type: 'flowNode',
        position: node.position || { x: 0, y: 0 },
        data: {
          nodeType: kind === 'milestone' ? 'milestone' : kind === 'meeting' ? 'meeting' : 'task',
          label,
          taskId: node.taskId,
          kind,
          status,
          statusClass: flowNodeStatusClass(status, kind),
          statusLabel: statusLabelFor?.(status, kind) || status,
        },
      };
    });

  const nodeIds = new Set(nodes.map(node => node.id));
  const flowNodeById = new Map((flowData?.nodes || []).map(node => [node.id, node]));
  const edges = (flowData?.edges || [])
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map(edge =>
      normalizeFlowEdgeDirection(
        {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || 'source-bottom',
          targetHandle: edge.targetHandle || 'target-top',
          markerEnd: ARROW_MARKER,
        },
        flowNodeById,
        taskById
      )
    );

  return { nodes, edges };
}

function serializeFlow(nodes, edges) {
  return {
    nodes: nodes.map(node => ({
      id: node.id,
      nodeType: node.data?.nodeType || (node.data?.boardId ? 'kanban' : 'task'),
      taskId: node.data?.taskId || null,
      boardId: node.data?.boardId || null,
      label: String(node.data?.label || '').slice(0, 120),
      position: node.position,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
    })),
  };
}

function mergeNodeData(currentNodes, freshNodes) {
  const freshById = new Map(freshNodes.map(node => [node.id, node]));
  const currentById = new Map(currentNodes.map(node => [node.id, node]));
  const merged = currentNodes
    .filter(node => freshById.has(node.id))
    .map(node => {
      const fresh = freshById.get(node.id);
      if (
        node.data?.label === fresh.data?.label &&
        node.data?.status === fresh.data?.status &&
        node.data?.statusClass === fresh.data?.statusClass &&
        node.data?.statusLabel === fresh.data?.statusLabel &&
        node.data?.kind === fresh.data?.kind &&
        node.data?.boardId === fresh.data?.boardId &&
        node.data?.nodeType === fresh.data?.nodeType
      ) {
        return node;
      }
      return { ...node, data: fresh.data };
    });
  for (const fresh of freshNodes) {
    if (!currentById.has(fresh.id)) merged.push(fresh);
  }
  return merged;
}

function edgesSame(current, nextEdges) {
  if (current.length !== nextEdges.length) return false;
  const ids = new Set(current.map(edge => edge.id));
  return nextEdges.every(edge => ids.has(edge.id));
}

function CampaignFlowCanvasInner({
  campaign,
  tasks,
  boards = [],
  flowDataVersion = 0,
  onTaskClick,
  onKanbanClick,
  onSaveFlowData,
  statusLabelFor,
}) {
  const colorMode = useHubColorMode();
  const { fitView } = useReactFlow();
  const initial = useMemo(
    () => buildFlowGraph(campaign?.flow_data, tasks, boards, statusLabelFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per campaign mount
    [campaign?.id]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const saveTimer = useRef(null);
  const lastSerialized = useRef('');
  const lastSyncKeys = useRef({ task: '', flow: '' });
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const tasksRef = useRef(tasks);
  const statusLabelForRef = useRef(statusLabelFor);
  tasksRef.current = tasks;
  statusLabelForRef.current = statusLabelFor;
  const isDragging = useRef(false);
  const hasLocalFlowEdits = useRef(false);
  const saveInFlight = useRef(false);
  const flowDataVersionRef = useRef(flowDataVersion);
  flowDataVersionRef.current = flowDataVersion;

  const flowLayoutKey = useMemo(
    () => flowStructureKey(campaign?.flow_data, boards),
    [campaign?.flow_data, boards]
  );

  const flowTasks = useMemo(() => {
    const ids = flowCanvasTaskIds(campaign?.flow_data);
    if (!ids.size) return tasks;
    return tasks.filter(task => ids.has(String(task.id)));
  }, [tasks, flowLayoutKey, campaign?.flow_data]);

  const taskSyncKey = useMemo(
    () => flowCanvasTaskSyncKey(tasks, campaign?.flow_data),
    [tasks, campaign?.flow_data]
  );

  const syncSerializedFromCampaign = useCallback(() => {
    const fresh = buildFlowGraph(campaign?.flow_data, flowTasks, boards, statusLabelForRef.current);
    lastSerialized.current = JSON.stringify(serializeFlow(fresh.nodes, fresh.edges));
    hasLocalFlowEdits.current = false;
    return fresh;
  }, [campaign?.flow_data, flowTasks, boards]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    syncSerializedFromCampaign();
  }, [flowDataVersion, syncSerializedFromCampaign]);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    hasLocalFlowEdits.current = false;
    lastSerialized.current = '';
    lastSyncKeys.current = { task: '', flow: '' };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const next = buildFlowGraph(campaign?.flow_data, flowTasks, boards, statusLabelForRef.current);
    setNodes(next.nodes);
    setEdges(next.edges);
    // Only rebuild the canvas when switching campaigns — not on every flow_data PATCH.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, setNodes, setEdges]);

  useEffect(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 0 });
    });
  }, [campaign?.id, fitView]);

  const flushSave = useCallback(
    async (nextNodes, nextEdges) => {
      const versionAtStart = flowDataVersionRef.current;
      const payload = serializeFlow(nextNodes, nextEdges);
      const key = JSON.stringify(payload);
      if (key === lastSerialized.current || saveInFlight.current) return;
      if (versionAtStart !== flowDataVersionRef.current) return;
      lastSerialized.current = key;
      hasLocalFlowEdits.current = true;
      saveInFlight.current = true;
      try {
        await onSaveFlowData?.(payload);
        if (flowDataVersionRef.current !== versionAtStart) {
          const fresh = syncSerializedFromCampaign();
          await onSaveFlowData?.(serializeFlow(fresh.nodes, fresh.edges));
        }
      } finally {
        saveInFlight.current = false;
        hasLocalFlowEdits.current = false;
      }
    },
    [onSaveFlowData, syncSerializedFromCampaign]
  );

  const scheduleSave = useCallback(
    (nextNodes, nextEdges) => {
      hasLocalFlowEdits.current = true;
      const payload = serializeFlow(nextNodes, nextEdges);
      const key = JSON.stringify(payload);
      if (key === lastSerialized.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const versionAtSchedule = flowDataVersionRef.current;
      saveTimer.current = setTimeout(() => {
        if (flowDataVersionRef.current !== versionAtSchedule) return;
        flushSave(nextNodes, nextEdges);
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave]
  );

  // Refresh labels/status and new flow nodes — never reset positions while editing locally.
  useEffect(() => {
    if (isDragging.current) return;
    if (
      taskSyncKey === lastSyncKeys.current.task &&
      flowLayoutKey === lastSyncKeys.current.flow
    ) {
      return;
    }
    lastSyncKeys.current = { task: taskSyncKey, flow: flowLayoutKey };

    const fresh = buildFlowGraph(campaign?.flow_data, flowTasks, boards, statusLabelForRef.current);

    if (hasLocalFlowEdits.current || saveInFlight.current) {
      setNodes(current => mergeNodeData(current, fresh.nodes));
      setEdges(current => {
        const nodeIds = new Set(fresh.nodes.map(node => node.id));
        const nextEdges = fresh.edges.filter(
          edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );
        if (edgesSame(current, nextEdges)) {
          return current;
        }
        return nextEdges;
      });
      return;
    }

    setNodes(current => mergeNodeData(current, fresh.nodes));
    setEdges(current => {
      const nodeIds = new Set(fresh.nodes.map(node => node.id));
      const nextEdges = fresh.edges.filter(
        edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
      if (edgesSame(current, nextEdges)) {
        return current;
      }
      return nextEdges;
    });
  }, [taskSyncKey, flowLayoutKey, campaign?.flow_data, flowTasks, boards, setNodes, setEdges]);

  const onConnect = useCallback(
    params => {
      setEdges(current => {
        const nodeById = new Map(nodesRef.current.map(node => [node.id, node]));
        const taskById = new Map((tasksRef.current || []).map(task => [task.id, task]));
        const normalized = normalizeFlowEdgeDirection(
          { ...params, id: newEdgeId(), markerEnd: ARROW_MARKER },
          nodeById,
          taskById
        );
        const next = addEdge(normalized, current);
        scheduleSave(nodesRef.current, next);
        return next;
      });
    },
    [scheduleSave, setEdges]
  );

  const onNodeDragStart = useCallback(() => {
    isDragging.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const handleNodeDragStop = useCallback(() => {
    isDragging.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushSave(nodesRef.current, edgesRef.current);
  }, [flushSave]);

  const handleEdgesDelete = useCallback(
    deleted => {
      setEdges(current => {
        const removed = new Set(deleted.map(edge => edge.id));
        const next = current.filter(edge => !removed.has(edge.id));
        scheduleSave(nodesRef.current, next);
        return next;
      });
    },
    [scheduleSave, setEdges]
  );

  const handleNodesDelete = useCallback(
    deleted => {
      const removed = new Set(deleted.map(node => node.id));
      setNodes(current => {
        const nextNodes = current.filter(node => !removed.has(node.id));
        setEdges(currentEdges => {
          const nextEdges = currentEdges.filter(
            edge => !removed.has(edge.source) && !removed.has(edge.target)
          );
          scheduleSave(nextNodes, nextEdges);
          return nextEdges;
        });
        return nextNodes;
      });
    },
    [scheduleSave, setNodes, setEdges]
  );

  const handleNodeClick = useCallback(
    async (_event, node) => {
      if (node?.data?.nodeType === 'kanban' && node?.data?.boardId) {
        onKanbanClick?.(node.data.boardId);
        return;
      }
      const taskId = node?.data?.taskId;
      if (!taskId) return;
      const local = tasksRef.current.find(item => item.id === taskId);
      if (local) {
        onTaskClick?.(local);
        return;
      }
      try {
        const res = await fetch(API_V1.internalTask(taskId), { credentials: 'same-origin' });
        if (!res.ok) return;
        const body = await res.json();
        const data = unwrapData(body);
        const task = data?.task || data;
        if (task?.id) onTaskClick?.(task);
      } catch {
        /* ignore */
      }
    },
    [onKanbanClick, onTaskClick]
  );

  const showBackground = nodes.length <= FLOW_BG_NODE_LIMIT;

  return (
    <div className="campaign-flow-canvas">
      <ReactFlow
        colorMode={colorMode}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onEdgesDelete={handleEdgesDelete}
        onNodesDelete={handleNodesDelete}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.2}
        maxZoom={1.5}
        onlyRenderVisibleElements
        elevateNodesOnSelect={false}
        autoPanOnNodeDrag={false}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        {showBackground ? <Background gap={22} size={1} /> : null}
        <Controls />
      </ReactFlow>
    </div>
  );
}

const CampaignFlowCanvasInnerMemo = memo(CampaignFlowCanvasInner, (prev, next) => (
  prev.campaign?.id === next.campaign?.id
  && prev.flowDataVersion === next.flowDataVersion
  && flowStructureKey(prev.campaign?.flow_data, prev.boards) === flowStructureKey(next.campaign?.flow_data, next.boards)
  && flowCanvasTaskSyncKey(prev.tasks, prev.campaign?.flow_data) === flowCanvasTaskSyncKey(next.tasks, next.campaign?.flow_data)
  && prev.onTaskClick === next.onTaskClick
  && prev.onKanbanClick === next.onKanbanClick
  && prev.onSaveFlowData === next.onSaveFlowData
  && prev.statusLabelFor === next.statusLabelFor
));

export default function CampaignFlowCanvas(props) {
  return (
    <ReactFlowProvider>
      <CampaignFlowCanvasInnerMemo {...props} />
    </ReactFlowProvider>
  );
}
