'use client';

import { memo, useCallback, useContext, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FlowCanvasActionsContext } from '@/components/internal/FlowCanvasActionsContext';

function flowNodeDataEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.label === b.label && a.notes === b.notes && a.nodeType === b.nodeType;
}

export default memo(function FrameworkFlowNode({ id, data, selected }) {
  const actionsRef = useContext(FlowCanvasActionsContext);
  const isFrame = data.nodeType === 'frame';
  const [label, setLabel] = useState(data.label || '');
  const [notes, setNotes] = useState(data.notes || '');

  useEffect(() => {
    setLabel(data.label || '');
    setNotes(data.notes || '');
  }, [data.label, data.notes, id]);

  const commit = useCallback(
    patch => {
      actionsRef?.current?.updateFrameworkNode?.(id, patch);
    },
    [actionsRef, id]
  );

  const flush = useCallback(() => {
    const nextLabel = String(label || '').trim().slice(0, 120) || 'Untitled';
    const nextNotes = isFrame ? String(notes || '').trim().slice(0, 500) : '';
    if (nextLabel !== data.label || nextNotes !== (data.notes || '')) {
      commit({ label: nextLabel, notes: nextNotes });
    }
  }, [commit, data.label, data.notes, isFrame, label, notes]);

  return (
    <div
      className={`campaign-flow-node is-framework is-${data.nodeType}${selected ? ' is-selected' : ''}`}
      aria-label={isFrame ? `Frame: ${data.label}` : `Label: ${data.label}`}
    >
      <Handle id="target-top" type="target" position={Position.Top} isConnectable className="campaign-flow-handle is-target-top" />
      <Handle id="source-top" type="source" position={Position.Top} isConnectable className="campaign-flow-handle is-source-top" />
      <Handle id="target-left" type="target" position={Position.Left} isConnectable />
      {selected ? (
        <div className="framework-flow-node-edit">
          <input
            className="framework-flow-node-title-input"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={flush}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label="Node title"
          />
          {isFrame ? (
            <textarea
              className="framework-flow-node-notes-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={flush}
              rows={3}
              aria-label="Frame notes"
            />
          ) : null}
        </div>
      ) : (
        <div className="framework-flow-node-display">
          <span className="campaign-flow-node-type-icon" aria-hidden="true">
            {isFrame ? '▢' : '●'}
          </span>
          <span className="campaign-flow-node-label">{data.label || 'Untitled'}</span>
          {isFrame && data.notes ? (
            <p className="framework-flow-node-notes-preview">{data.notes}</p>
          ) : null}
        </div>
      )}
      <Handle id="target-bottom" type="target" position={Position.Bottom} isConnectable className="campaign-flow-handle is-target-bottom" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} isConnectable className="campaign-flow-handle is-source-bottom" />
      <Handle id="source-right" type="source" position={Position.Right} isConnectable />
    </div>
  );
}, (prev, next) => prev.selected === next.selected && flowNodeDataEqual(prev.data, next.data));
