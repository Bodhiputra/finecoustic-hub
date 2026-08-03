'use client';

import { useCallback, useRef, useState } from 'react';
import ToastStack from '@/components/ToastStack';

let toastSeq = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback((message, { variant = 'info', duration = 4200, dismissLabel } = {}) => {
    const text = String(message || '').trim();
    if (!text) return null;
    const id = `toast-${++toastSeq}`;
    setToasts(prev => [...prev, { id, message: text, variant, dismissLabel }]);
    const timer = window.setTimeout(() => dismiss(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [dismiss]);

  const toast = useCallback(
    (message, opts) => push(message, { ...opts, variant: opts?.variant || 'info' }),
    [push]
  );
  toast.success = (message, opts) => push(message, { ...opts, variant: 'success' });
  toast.error = (message, opts) => push(message, { ...opts, variant: 'error' });

  const toastStack = <ToastStack toasts={toasts} onDismiss={dismiss} />;

  return { toast, toastStack, dismiss };
}
