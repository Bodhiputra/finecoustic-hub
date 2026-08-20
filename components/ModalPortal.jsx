'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

/** Render modals on document.body — avoids sidebar transform breaking position:fixed. */
export default function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !children) return null;
  return createPortal(children, document.body);
}
