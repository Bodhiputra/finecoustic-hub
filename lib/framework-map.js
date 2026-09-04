import { defaultFlowNodePosition } from '@/lib/campaign-flow-utils';

export const FRAMEWORK_MAP_MODE = 'framework';
export const WORKFLOW_MAP_MODE = 'workflow';

export const FRAMEWORK_NODE_TYPES = ['label', 'frame'];

export function isFrameworkMapCampaign(campaign) {
  return String(campaign?.map_mode || WORKFLOW_MAP_MODE) === FRAMEWORK_MAP_MODE;
}

export function isFrameworkFlowNodeType(nodeType) {
  return nodeType === 'label' || nodeType === 'frame';
}

export function normalizeMapMode(raw) {
  return String(raw || WORKFLOW_MAP_MODE) === FRAMEWORK_MAP_MODE
    ? FRAMEWORK_MAP_MODE
    : WORKFLOW_MAP_MODE;
}

export function newFrameworkNodeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `fw-${crypto.randomUUID()}`
    : `fw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Append a structural label or frame node — no task/board backing. */
export function appendFrameworkNodeToFlow(flowData, { nodeType, label, notes }, position) {
  const data = flowData || { nodes: [], edges: [] };
  const type = nodeType === 'frame' ? 'frame' : 'label';
  return {
    nodes: [
      ...(data.nodes || []),
      {
        id: newFrameworkNodeId(),
        nodeType: type,
        label: String(label || (type === 'frame' ? 'Stage' : 'Label')).trim().slice(0, 120) || 'Untitled',
        notes: type === 'frame' ? String(notes || '').trim().slice(0, 500) : '',
        position: defaultFlowNodePosition(data, position),
      },
    ],
    edges: data.edges || [],
  };
}
