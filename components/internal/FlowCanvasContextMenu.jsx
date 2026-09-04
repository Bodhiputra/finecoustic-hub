'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/Icon';

const WORKFLOW_ITEMS = [
  { kind: 'task', labelKey: 'addTaskIssue', icon: 'plus' },
  { kind: 'milestone', labelKey: 'addMilestone', icon: 'calendar' },
  { kind: 'kanban', labelKey: 'addKanbanNode', icon: 'kanban' },
];

const FRAMEWORK_ITEMS = [
  { kind: 'label', labelKey: 'addFrameworkLabel', icon: 'plus' },
  { kind: 'frame', labelKey: 'addFrameworkFrame', icon: 'layout' },
];

export default function FlowCanvasContextMenu({
  open,
  x = 0,
  y = 0,
  t,
  canAddTask = false,
  canAddMilestone = false,
  canAddKanban = false,
  canAddLabel = false,
  canAddFrame = false,
  frameworkMode = false,
  onPick,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = event => {
      if (event.key === 'Escape') onClose?.();
    };
    const onPointerDown = event => {
      if (event.target.closest?.('.campaign-flow-context-menu')) return;
      onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const catalog = frameworkMode ? FRAMEWORK_ITEMS : WORKFLOW_ITEMS;
  const items = catalog.filter(item => {
    if (item.kind === 'task') return canAddTask;
    if (item.kind === 'milestone') return canAddMilestone;
    if (item.kind === 'kanban') return canAddKanban;
    if (item.kind === 'label') return canAddLabel;
    if (item.kind === 'frame') return canAddFrame;
    return false;
  });

  if (!items.length) return null;

  return createPortal(
    <div
      className="campaign-flow-context-menu"
      style={{ top: y, left: x }}
      role="menu"
      aria-label={t('hub.internal.flowContextMenu')}
      onContextMenu={event => event.preventDefault()}
    >
      {items.map(item => (
        <button
          key={item.kind}
          type="button"
          className="campaign-flow-context-menu-item"
          role="menuitem"
          onClick={() => onPick?.(item.kind)}
        >
          <Icon name={item.icon} size={15} />
          {t(`hub.internal.${item.labelKey}`)}
        </button>
      ))}
    </div>,
    document.body
  );
}
