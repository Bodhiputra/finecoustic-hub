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
    <div className={`internal-sidebar-section${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <div className="internal-sidebar-section-head">
        <button
          type="button"
          className="internal-sidebar-section-toggle"
          aria-expanded={open}
          onClick={() => setOpen(prev => !prev)}
        >
          <span className="internal-sidebar-section-label">{title}</span>
          <Icon name="chevronDown" size={14} className="internal-sidebar-chevron" />
        </button>
        {onAction && (
          <button
            type="button"
            className="internal-sidebar-section-action"
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
      {open && <div className="internal-sidebar-section-body">{children}</div>}
    </div>
  );
}
