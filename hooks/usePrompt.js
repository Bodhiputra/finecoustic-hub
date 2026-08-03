'use client';

import { useCallback, useRef, useState } from 'react';
import PromptModal from '@/components/PromptModal';

const EMPTY_OPTIONS = {};

export function usePrompt() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [value, setValue] = useState('');
  const resolverRef = useRef(null);

  const requestPrompt = useCallback(opts => {
    return new Promise(resolve => {
      resolverRef.current = resolve;
      setOptions(opts || EMPTY_OPTIONS);
      setValue(String(opts?.defaultValue || ''));
      setOpen(true);
    });
  }, []);

  const finish = useCallback(result => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
  }, []);

  const valueRef = useRef(value);
  valueRef.current = value;

  const handleCancel = useCallback(() => finish(null), [finish]);
  const handleConfirm = useCallback(() => {
    finish(String(valueRef.current || '').trim() || null);
  }, [finish]);

  const promptDialog = (
    <PromptModal
      open={open}
      title={options.title}
      message={options.message}
      label={options.label}
      placeholder={options.placeholder}
      value={value}
      onChange={setValue}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      busy={options.busy}
      maxLength={options.maxLength}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );

  return { requestPrompt, promptDialog };
}
