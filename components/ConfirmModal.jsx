'use client';

import { useEffect, useRef } from 'react';
import HubModal from '@/components/HubModal';

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

  const confirmClass =
    confirmVariant === 'primary' ? 'appdev-btn-primary' : 'appdev-btn-danger';

  return (
    <HubModal
      open={open}
      onClose={onCancel}
      className="appdev-confirm-modal"
      role="alertdialog"
      labelledBy={title ? 'confirm-modal-title' : undefined}
      describedBy="confirm-modal-message"
      disableBackdropClose={busy}
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
    </HubModal>
  );
}
