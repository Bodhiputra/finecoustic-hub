'use client';

import ModalPortal from '@/components/ModalPortal';

/**
 * Centered modal shell — always portaled to document.body.
 * Use for confirm, prompt, and form dialogs (not slide-out panels).
 */
export default function HubModal({
  open,
  onClose,
  children,
  className = '',
  backdropClassName = '',
  role = 'dialog',
  labelledBy,
  describedBy,
  disableBackdropClose = false,
}) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className={`appdev-modal-backdrop appdev-confirm-backdrop ${backdropClassName}`.trim()}
        role="presentation"
        onClick={disableBackdropClose ? undefined : onClose}
      >
        <div
          className={`appdev-modal ${className}`.trim()}
          role={role}
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}
