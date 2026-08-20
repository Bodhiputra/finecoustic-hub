'use client';

import ModalPortal from '@/components/ModalPortal';

/** Centered KOL / marketing modal — portaled so it is never trapped in the sidebar. */
export default function KolModal({ open, onClose, wide = false, children, labelledBy }) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div className="kol-modal-backdrop" role="presentation" onClick={onClose}>
        <div
          className={`kol-modal${wide ? ' kol-modal--wide' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}
