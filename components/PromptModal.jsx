'use client';

import { useEffect, useId, useRef } from 'react';
import HubModal from '@/components/HubModal';

export default function PromptModal({
  open,
  title,
  message,
  label,
  placeholder = '',
  value,
  onChange,
  confirmLabel,
  cancelLabel,
  busy = false,
  maxLength = 120,
  onConfirm,
  onCancel,
}) {
  const inputRef = useRef(null);
  const inputId = useId();
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    const onKey = e => {
      if (e.key === 'Escape' && !busy) onCancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, busy]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!busy) onConfirm();
  }

  return (
    <HubModal
      open={open}
      onClose={onCancel}
      className="appdev-confirm-modal appdev-prompt-modal"
      labelledBy={title ? 'prompt-modal-title' : undefined}
      disableBackdropClose={busy}
    >
      <form onSubmit={handleSubmit}>
        {title ? (
          <h2 id="prompt-modal-title" className="appdev-confirm-title">
            {title}
          </h2>
        ) : null}
        {message ? <p className="appdev-confirm-message">{message}</p> : null}
        <label className="appdev-prompt-field" htmlFor={inputId}>
          {label ? <span className="appdev-prompt-label">{label}</span> : null}
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            className="appdev-prompt-input"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={busy}
            maxLength={maxLength}
            autoComplete="off"
          />
        </label>
        <footer className="appdev-confirm-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="submit" className="appdev-btn-primary" disabled={busy || !String(value || '').trim()}>
            {confirmLabel}
          </button>
        </footer>
      </form>
    </HubModal>
  );
}
