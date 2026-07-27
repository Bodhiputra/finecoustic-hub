'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';

export default function SidebarSection({
  title,
  defaultOpen = true,
  children,
  className = '',
  actionLabel = '',
  onAction,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`warzone-sidebar-section${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <div className="warzone-sidebar-section-head">
        <button
          type="button"
          className="warzone-sidebar-section-toggle"
          aria-expanded={open}
          onClick={() => setOpen(prev => !prev)}
        >
          <span className="warzone-sidebar-section-label">{title}</span>
          <Icon name="chevronDown" size={14} className="warzone-sidebar-chevron" />
        </button>
        {onAction && (
          <button
            type="button"
            className="warzone-sidebar-section-action"
            onClick={e => {
              e.stopPropagation();
              onAction();
            }}
            aria-label={actionLabel}
            title={actionLabel}
          >
            <Icon name="plus" size={14} />
          </button>
        )}
      </div>
      {open && <div className="warzone-sidebar-section-body">{children}</div>}
    </div>
  );
}
