'use client';

import { useCallback, useRef, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';

const EMPTY_OPTIONS = {};

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const resolverRef = useRef(null);

  const requestConfirm = useCallback(opts => {
    return new Promise(resolve => {
      resolverRef.current = resolve;
      setOptions(opts);
      setOpen(true);
    });
  }, []);

  const finish = useCallback(result => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
  }, []);

  const confirmDialog = (
    <ConfirmModal
      open={open}
      title={options.title}
      message={options.message}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      confirmVariant={options.confirmVariant || 'danger'}
      busy={options.busy}
      onCancel={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  );

  return { requestConfirm, confirmDialog };
}
