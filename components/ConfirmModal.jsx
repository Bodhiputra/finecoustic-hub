'use client';

import { useEffect, useRef } from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    const onKey = e => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass =
    confirmVariant === 'primary' ? 'appdev-btn-primary' : 'appdev-btn-danger';

  return (
    <div
      className="appdev-modal-backdrop appdev-confirm-backdrop"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="appdev-modal appdev-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title ? 'confirm-modal-title' : undefined}
        aria-describedby="confirm-modal-message"
        onClick={e => e.stopPropagation()}
      >
        {title ? (
          <h2 id="confirm-modal-title" className="appdev-confirm-title">
            {title}
          </h2>
        ) : null}
        <p id="confirm-modal-message" className="appdev-confirm-message">
          {message}
        </p>
        <footer className="appdev-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
