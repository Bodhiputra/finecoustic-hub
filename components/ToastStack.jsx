'use client';

import Icon from '@/components/Icon';

export default function ToastStack({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="hub-toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => (
        <div key={toast.id} className={`hub-toast is-${toast.variant || 'info'}`}>
          <span className="hub-toast-message">{toast.message}</span>
          <button
            type="button"
            className="hub-toast-dismiss"
            onClick={() => onDismiss?.(toast.id)}
            aria-label={toast.dismissLabel || 'Dismiss'}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
