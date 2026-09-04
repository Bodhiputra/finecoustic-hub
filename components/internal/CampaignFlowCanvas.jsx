'use client';

import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  SelectionMode,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { useLocale } from '@/components/LocaleProvider';
import FlowCanvasContextMenu from '@/components/internal/FlowCanvasContextMenu';
import { FlowCanvasActionsContext } from '@/components/internal/FlowCanvasActionsContext';
import FrameworkFlowNode from '@/components/internal/FrameworkFlowNode';
import Icon from '@/components/Icon';
import {
  flowCanvasTaskIds,
  flowNodeStatusClass,
  flowCanvasTaskSyncKey,
  flowStructureKey,
  normalizeFlowEdgeDirection,
  getFlowDragFollowers,
} from '@/lib/campaign-flow-utils';
import { isFrameworkFlowNodeType } from '@/lib/framework-map';

const SAVE_DEBOUNCE_MS = 400;
const FLOW_BG_NODE_LIMIT = 35;
const ARROW_MARKER = { type: MarkerType.ArrowClosed };
const DEFAULT_EDGE_OPTIONS = { type: 'default', markerEnd: ARROW_MARKER };
const FLOW_NODE_CENTER_OFFSET = { x: 70, y: 28 };

function flowPositionAtCursor(screenToFlowPosition, clientX, clientY) {
  const point = screenToFlowPosition({ x: clientX, y: clientY });
  return {
    x: point.x - FLOW_NODE_CENTER_OFFSET.x,
    y: point.y - FLOW_NODE_CENTER_OFFSET.y,
  };
}

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
    && a.notes === b.notes
  );
}

const FlowNode = memo(function FlowNode({ data, selected }) {
  const actionsRef = useContext(FlowCanvasActionsContext);
  const isMilestone = data.nodeType === 'milestone' || data.kind === 'milestone';
  const isKanban = data.nodeType === 'kanban';
  const typeClass = isKanban ? ' is-kanban' : isMilestone ? ' is-milestone' : ' is-task';
  const typeLabel = isKanban ? 'Kanban board' : isMilestone ? 'Milestone' : 'Task';

  const handleClick = useCallback(event => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) return;
    const actions = actionsRef?.current;
    if (!actions) return;
    if (isKanban && data.boardId) {
      actions.openKanban?.(data.boardId);
      return;
    }
    if (data.taskId) actions.openTask?.(data.taskId);
  }, [actionsRef, data.boardId, data.taskId, isKanban]);

  return (
    <div
      className={`campaign-flow-node${typeClass}${selected ? ' is-selected' : ''}`}
      aria-label={`${typeLabel}: ${data.label || 'Untitled'}`}
      onClick={handleClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Handle id="target-top" type="target" position={Position.Top} isConnectable className="campaign-flow-handle is-target-top" />
      <Handle id="source-top" type="source" position={Position.Top} isConnectable className="campaign-flow-handle is-source-top" />
      <Handle id="target-left" type="target" position={Position.Left} isConnectable />
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
      <Handle id="target-bottom" type="target" position={Position.Bottom} isConnectable className="campaign-flow-handle is-target-bottom" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} isConnectable className="campaign-flow-handle is-source-bottom" />
      <Handle id="source-right" type="source" position={Position.Right} isConnectable />
    </div>
  );
}, (prev, next) => prev.selected === next.selected && flowNodeDataEqual(prev.data, next.data));

const nodeTypes = { flowNode: FlowNode, frameworkNode: FrameworkFlowNode };

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
    .filter(node =>
      node.taskId
      || node.boardId
      || node.nodeType === 'kanban'
      || isFrameworkFlowNodeType(node.nodeType)
    )
    .map(node => {
      const nodeType = node.nodeType || (node.boardId ? 'kanban' : 'task');
      if (isFrameworkFlowNodeType(nodeType)) {
        return {
          id: node.id,
          type: 'frameworkNode',
          position: node.position || { x: 0, y: 0 },
          data: {
            nodeType: nodeType === 'frame' ? 'frame' : 'label',
            label: node.label || 'Untitled',
            notes: node.notes || '',
          },
        };
      }
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
  const edges = (flowData?.edges || [])
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || 'source-bottom',
      targetHandle: edge.targetHandle || 'target-top',
      type: 'default',
      markerEnd: ARROW_MARKER,
    }));

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
      notes: isFrameworkFlowNodeType(node.data?.nodeType)
        ? String(node.data?.notes || '').slice(0, 500)
        : undefined,
      position: node.position,
    })).map(node => {
      if (!isFrameworkFlowNodeType(node.nodeType)) {
        const { notes, ...rest } = node;
        return rest;
      }
      return node;
    }),
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
        node.data?.nodeType === fresh.data?.nodeType &&
        node.data?.notes === fresh.data?.notes
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

function mergeEdgeHandles(current, nextEdges) {
  const currentById = new Map(current.map(edge => [edge.id, edge]));
  return nextEdges.map(edge => {
    const prev = currentById.get(edge.id);
    if (!prev) return edge;
    return {
      ...edge,
      sourceHandle: edge.sourceHandle || prev.sourceHandle,
      targetHandle: edge.targetHandle || prev.targetHandle,
    };
  });
}

function edgesSame(current, nextEdges) {
  if (current.length !== nextEdges.length) return false;
  const byId = new Map(current.map(edge => [edge.id, edge]));
  return nextEdges.every(edge => {
    const prev = byId.get(edge.id);
    return (
      prev
      && prev.source === edge.source
      && prev.target === edge.target
      && (prev.sourceHandle || 'source-bottom') === (edge.sourceHandle || 'source-bottom')
      && (prev.targetHandle || 'target-top') === (edge.targetHandle || 'target-top')
    );
  });
}

function CampaignFlowCanvasInner({
  campaign,
  tasks,
  boards = [],
  flowDataVersion = 0,
  onTaskClick,
  onKanbanClick,
  onSaveFlowData,
  onCanvasAddNode,
  canAddTask = false,
  canAddMilestone = false,
  canAddKanban = false,
  canAddLabel = false,
  canAddFrame = false,
  frameworkMode = false,
  statusLabelFor,
}) {
  const { t } = useLocale();
  const colorMode = useHubColorMode();
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [contextMenu, setContextMenu] = useState(null);
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
  const onTaskClickRef = useRef(onTaskClick);
  const onKanbanClickRef = useRef(onKanbanClick);
  const flowActionsRef = useRef({});
  tasksRef.current = tasks;
  statusLabelForRef.current = statusLabelFor;
  onTaskClickRef.current = onTaskClick;
  onKanbanClickRef.current = onKanbanClick;
  flowActionsRef.current = {
    openKanban: boardId => {
      if (suppressClickRef.current) return;
      onKanbanClickRef.current?.(boardId);
    },
    openTask: async taskId => {
      if (suppressClickRef.current || !taskId) return;
      const local = tasksRef.current.find(item => String(item.id) === String(taskId));
      if (local) {
        onTaskClickRef.current?.(local);
        return;
      }
      try {
        const res = await fetch(API_V1.internalTask(taskId), { credentials: 'same-origin' });
        if (!res.ok) return;
        const body = await res.json();
        const data = unwrapData(body, 'task');
        const task = data?.task || data;
        if (task?.id) onTaskClickRef.current?.(task);
      } catch {
        /* ignore */
      }
    },
    updateFrameworkNode: (nodeId, patch) => {
      setNodes(current => {
        const next = current.map(node =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node
        );
        scheduleSave(next, edgesRef.current);
        return next;
      });
    },
  };
  const isDragging = useRef(false);
  const suppressClickRef = useRef(false);
  const dragFollowRef = useRef({ nodeId: '', lastX: 0, lastY: 0, followers: new Set() });
  const hasLocalFlowEdits = useRef(false);
  const saveInFlight = useRef(false);
  const flowDataVersionRef = useRef(flowDataVersion);
  const campaignFlowDataRef = useRef(campaign?.flow_data);
  flowDataVersionRef.current = flowDataVersion;
  campaignFlowDataRef.current = campaign?.flow_data;

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
    const fresh = buildFlowGraph(
      campaignFlowDataRef.current,
      flowTasks,
      boards,
      statusLabelForRef.current
    );
    lastSerialized.current = JSON.stringify(serializeFlow(fresh.nodes, fresh.edges));
    hasLocalFlowEdits.current = false;
    // Only reset save baseline when parent bumps flowDataVersion (external save / campaign switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowDataVersion]);

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

  // Refresh task labels/status on nodes — never touch edges or positions.
  useEffect(() => {
    if (isDragging.current) return;
    if (taskSyncKey === lastSyncKeys.current.task) return;
    lastSyncKeys.current = { task: taskSyncKey, flow: lastSyncKeys.current.flow };

    const fresh = buildFlowGraph(
      campaignFlowDataRef.current,
      flowTasks,
      boards,
      statusLabelForRef.current
    );
    setNodes(current => mergeNodeData(current, fresh.nodes));
  }, [taskSyncKey, flowTasks, boards, setNodes]);

  // New/removed nodes or edges from server — preserve local positions when editing.
  useEffect(() => {
    if (isDragging.current) return;
    if (flowLayoutKey === lastSyncKeys.current.flow) return;
    lastSyncKeys.current = { flow: flowLayoutKey, task: lastSyncKeys.current.task };

    const fresh = buildFlowGraph(
      campaignFlowDataRef.current,
      flowTasks,
      boards,
      statusLabelForRef.current
    );

    if (hasLocalFlowEdits.current || saveInFlight.current) {
      setNodes(current => mergeNodeData(current, fresh.nodes));
      setEdges(current => {
        const nodeIds = new Set(fresh.nodes.map(node => node.id));
        const nextEdges = mergeEdgeHandles(
          current,
          fresh.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        );
        return edgesSame(current, nextEdges) ? current : nextEdges;
      });
      return;
    }

    setNodes(current => mergeNodeData(current, fresh.nodes));
    setEdges(current => {
      const nodeIds = new Set(fresh.nodes.map(node => node.id));
      const nextEdges = mergeEdgeHandles(
        current,
        fresh.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      );
      return edgesSame(current, nextEdges) ? current : nextEdges;
    });
  }, [flowLayoutKey, flowTasks, boards, setNodes, setEdges]);

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

  const isValidConnection = useCallback(connection => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;
    return !edgesRef.current.some(
      edge =>
        edge.source === connection.source
        && edge.target === connection.target
        && (edge.sourceHandle || null) === (connection.sourceHandle || null)
        && (edge.targetHandle || null) === (connection.targetHandle || null)
    );
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const onPaneContextMenu = useCallback(
    event => {
      if (!onCanvasAddNode) return;
      if (!canAddTask && !canAddMilestone && !canAddKanban && !canAddLabel && !canAddFrame) return;
      event.preventDefault();
      const position = flowPositionAtCursor(screenToFlowPosition, event.clientX, event.clientY);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        position,
      });
    },
    [canAddTask, canAddMilestone, canAddKanban, canAddLabel, canAddFrame, onCanvasAddNode, screenToFlowPosition]
  );

  const addFrameworkNodeAtCenter = useCallback(
    kind => {
      if (!onCanvasAddNode) return;
      const bounds = document.querySelector('.campaign-flow-canvas')?.getBoundingClientRect();
      const cx = bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2;
      const cy = bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2;
      onCanvasAddNode({ kind, position: flowPositionAtCursor(screenToFlowPosition, cx, cy) });
    },
    [onCanvasAddNode, screenToFlowPosition]
  );

  const onNodeContextMenu = useCallback(event => {
    event.preventDefault();
  }, []);

  const handleContextMenuPick = useCallback(
    kind => {
      if (!contextMenu?.position || !onCanvasAddNode) return;
      onCanvasAddNode({ kind, position: contextMenu.position });
      closeContextMenu();
    },
    [closeContextMenu, contextMenu, onCanvasAddNode]
  );

  const onNodeDragStart = useCallback((_, node, currentNodes) => {
    isDragging.current = true;
    suppressClickRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const selectedCount = currentNodes.filter(n => n.selected).length;
    const followers =
      selectedCount > 1
        ? new Set()
        : getFlowDragFollowers(node.id, edgesRef.current, nodesRef.current);
    dragFollowRef.current = {
      nodeId: node.id,
      lastX: node.position.x,
      lastY: node.position.y,
      followers,
    };
  }, []);

  const onNodeDrag = useCallback((_, node) => {
    const drag = dragFollowRef.current;
    if (node.id !== drag.nodeId || drag.followers.size === 0) return;

    const dx = node.position.x - drag.lastX;
    const dy = node.position.y - drag.lastY;
    if (dx === 0 && dy === 0) return;

    drag.lastX = node.position.x;
    drag.lastY = node.position.y;

    setNodes(current =>
      current.map(n => {
        if (n.id === node.id) {
          return { ...n, position: node.position, dragging: true };
        }
        if (!drag.followers.has(n.id)) return n;
        return {
          ...n,
          position: { x: n.position.x + dx, y: n.position.y + dy },
          dragging: true,
        };
      })
    );
  }, [setNodes]);

  const handleNodeDragStop = useCallback(() => {
    isDragging.current = false;
    dragFollowRef.current = { nodeId: '', lastX: 0, lastY: 0, followers: new Set() };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushSave(nodesRef.current, edgesRef.current);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
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

  const showBackground = nodes.length <= FLOW_BG_NODE_LIMIT;

  return (
    <FlowCanvasActionsContext.Provider value={flowActionsRef}>
      <div className="campaign-flow-canvas">
        {frameworkMode ? (
          <div className="campaign-flow-framework-toolbar" role="toolbar" aria-label={t('hub.internal.frameworkMapToolbar')}>
            <button type="button" className="appdev-btn-ghost" onClick={() => addFrameworkNodeAtCenter('label')}>
              <Icon name="plus" size={14} />
              {t('hub.internal.addFrameworkLabel')}
            </button>
            <button type="button" className="appdev-btn-ghost" onClick={() => addFrameworkNodeAtCenter('frame')}>
              <Icon name="plus" size={14} />
              {t('hub.internal.addFrameworkFrame')}
            </button>
            <span className="campaign-flow-framework-hint">{t('hub.internal.frameworkMapHint')}</span>
          </div>
        ) : null}
        <ReactFlow
          colorMode={colorMode}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          isValidConnection={isValidConnection}
          connectionMode={ConnectionMode.Loose}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onEdgesDelete={handleEdgesDelete}
          onNodesDelete={handleNodesDelete}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          deleteKeyCode={['Backspace', 'Delete']}
          minZoom={0.2}
          maxZoom={1.5}
          onlyRenderVisibleElements
          elevateNodesOnSelect={false}
          autoPanOnNodeDrag={false}
          selectNodesOnDrag={false}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnScroll
          panOnScrollMode="free"
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch
          multiSelectionKeyCode="Shift"
          proOptions={{ hideAttribution: true }}
        >
          {showBackground ? <Background gap={22} size={1} /> : null}
          <Controls />
        </ReactFlow>
        <FlowCanvasContextMenu
          open={Boolean(contextMenu)}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          t={t}
          canAddTask={canAddTask}
          canAddMilestone={canAddMilestone}
          canAddKanban={canAddKanban}
          canAddLabel={canAddLabel}
          canAddFrame={canAddFrame}
          frameworkMode={frameworkMode}
          onPick={handleContextMenuPick}
          onClose={closeContextMenu}
        />
      </div>
    </FlowCanvasActionsContext.Provider>
  );
}

export default function CampaignFlowCanvas(props) {
  return (
    <ReactFlowProvider>
      <CampaignFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
