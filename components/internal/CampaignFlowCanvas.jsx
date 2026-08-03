'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function newEdgeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `edge-${Date.now()}`;
}

function FlowNode({ data, selected }) {
  const isMilestone = data.kind === 'milestone';
  return (
    <div className={`campaign-flow-node${isMilestone ? ' is-milestone' : ''}${selected ? ' is-selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="campaign-flow-node-meta">
        <span className="campaign-flow-node-kind">{isMilestone ? '◇ Milestone' : '□ Task'}</span>
        {data.status ? (
          <span className={`campaign-flow-node-status is-${data.status}`}>{data.statusLabel || data.status}</span>
        ) : null}
      </div>
      <span className="campaign-flow-node-label">{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

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

function buildFlowGraph(flowData, tasks, statusLabelFor) {
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const nodes = (flowData?.nodes || [])
    .filter(node => node.taskId)
    .map(node => {
      const task = taskById.get(node.taskId);
      const label = task?.title || node.label || 'Untitled';
      const kind = task?.kind || 'task';
      const status = task?.status || 'todo';
      return {
        id: node.id,
        type: 'flowNode',
        position: node.position || { x: 0, y: 0 },
        data: {
          label,
          taskId: node.taskId,
          kind,
          status,
          statusLabel: statusLabelFor?.(status) || status,
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
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

  return { nodes, edges };
}

function serializeFlow(nodes, edges) {
  return {
    nodes: nodes.map(node => ({
      id: node.id,
      taskId: node.data?.taskId || null,
      label: String(node.data?.label || '').slice(0, 120),
      position: node.position,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

function CampaignFlowCanvasInner({
  campaign,
  tasks,
  onTaskClick,
  onSaveFlowData,
  statusLabelFor,
}) {
  const colorMode = useHubColorMode();
  const { fitView } = useReactFlow();
  const initial = useMemo(
    () => buildFlowGraph(campaign?.flow_data, tasks, statusLabelFor),
    [campaign?.id, campaign?.flow_data, tasks, statusLabelFor]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const saveTimer = useRef(null);
  const lastSerialized = useRef('');
  const lastSyncKey = useRef('');
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    lastSyncKey.current = '';
  }, [campaign?.id]);

  useEffect(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 200 });
    });
  }, [campaign?.id, fitView]);

  const syncKey = useMemo(() => {
    const ids = tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.kind}`).sort().join(',');
    const flowKey = JSON.stringify(campaign?.flow_data || {});
    return `${campaign?.id || ''}|${ids}|${flowKey}`;
  }, [campaign?.id, campaign?.flow_data, tasks]);

  const scheduleSave = useCallback(
    (nextNodes, nextEdges) => {
      const payload = serializeFlow(nextNodes, nextEdges);
      const key = JSON.stringify(payload);
      if (key === lastSerialized.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        lastSerialized.current = key;
        await onSaveFlowData?.(payload);
      }, 700);
    },
    [onSaveFlowData]
  );

  useEffect(() => {
    if (syncKey === lastSyncKey.current) return;
    const next = buildFlowGraph(campaign?.flow_data, tasks, statusLabelFor);
    const localKey = JSON.stringify(serializeFlow(nodesRef.current, edgesRef.current));
    const nextKey = JSON.stringify(serializeFlow(next.nodes, next.edges));
    if (localKey === nextKey) {
      setNodes(current =>
        current.map(node => {
          const fresh = next.nodes.find(n => n.id === node.id);
          if (!fresh) return node;
          if (
            node.data?.label === fresh.data?.label &&
            node.data?.status === fresh.data?.status &&
            node.data?.statusLabel === fresh.data?.statusLabel &&
            node.data?.kind === fresh.data?.kind
          ) {
            return node;
          }
          return { ...node, data: fresh.data };
        })
      );
      lastSyncKey.current = syncKey;
      return;
    }
    lastSyncKey.current = syncKey;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [syncKey, campaign?.flow_data, tasks, statusLabelFor, setNodes, setEdges]);

  const onConnect = useCallback(
    params => {
      setEdges(current => {
        const next = addEdge({ ...params, id: newEdgeId(), markerEnd: { type: MarkerType.ArrowClosed } }, current);
        scheduleSave(nodesRef.current, next);
        return next;
      });
    },
    [scheduleSave, setEdges]
  );

  const handleNodeDragStop = useCallback(() => {
    scheduleSave(nodesRef.current, edgesRef.current);
  }, [scheduleSave]);

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
      const taskId = node?.data?.taskId;
      if (!taskId) return;
      const local = tasks.find(item => item.id === taskId);
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
    [onTaskClick, tasks]
  );

  return (
    <div className="campaign-flow-canvas">
      <ReactFlow
        colorMode={colorMode}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        onEdgesDelete={handleEdgesDelete}
        onNodesDelete={handleNodesDelete}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default function CampaignFlowCanvas(props) {
  return (
    <ReactFlowProvider>
      <CampaignFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
