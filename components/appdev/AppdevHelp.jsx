'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

const SECTIONS = ['login', 'create', 'assign', 'workflow', 'discuss', 'files'];
const FAB_POS_KEY = 'appdev-help-fab-pos';
const FAB_SIZE = 48;
const FAB_PAD = 8;
const DRAG_THRESHOLD = 6;

function clampPosition(x, y) {
  if (typeof window === 'undefined') return { x, y };
  const maxX = window.innerWidth - FAB_SIZE - FAB_PAD;
  const maxY = window.innerHeight - FAB_SIZE - FAB_PAD;
  return {
    x: Math.min(maxX, Math.max(FAB_PAD, x)),
    y: Math.min(maxY, Math.max(FAB_PAD, y)),
  };
}

function defaultPosition() {
  const pad = Math.min(window.innerWidth * 0.03, 24);
  return clampPosition(
    window.innerWidth - FAB_SIZE - pad,
    window.innerHeight - FAB_SIZE - pad,
  );
}

function loadPosition() {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return clampPosition(parsed.x, parsed.y);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function AppdevHelp({ open, onClose, onToggle, t }) {
  const [pos, setPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const posRef = useRef(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    pointerId: null,
  });

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    setPos(loadPosition() || defaultPosition());
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPos(prev => (prev ? clampPosition(prev.x, prev.y) : prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const finishDrag = useCallback((target, pointerId, toggle) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== pointerId) return;
    d.active = false;
    setDragging(false);
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    if (d.moved && posRef.current) {
      localStorage.setItem(FAB_POS_KEY, JSON.stringify(posRef.current));
      return;
    }
    toggle();
  }, []);

  const onPointerDown = useCallback((e) => {
    if (!pos) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setDragging(true);
    setPos(clampPosition(d.originX + dx, d.originY + dy));
  }, []);

  const onPointerUp = useCallback((e) => {
    finishDrag(e.currentTarget, e.pointerId, onToggle);
  }, [finishDrag, onToggle]);

  const onPointerCancel = useCallback((e) => {
    finishDrag(e.currentTarget, e.pointerId, () => {});
  }, [finishDrag]);

  return (
    <>
      {open && (
        <section className="appdev-help" role="region" aria-label={t('appdev.help.title')}>
          <header className="appdev-help-header">
            <div className="appdev-help-head-text">
              <h2 className="appdev-help-title">{t('appdev.help.title')}</h2>
              <p className="appdev-help-intro">{t('appdev.help.intro')}</p>
            </div>
            <button type="button" className="appdev-help-dismiss" onClick={onClose}>
              {t('appdev.help.dismiss')}
            </button>
          </header>
          <div className="appdev-help-grid">
            {SECTIONS.map(key => (
              <article key={key} className="appdev-help-card">
                <h3 className="appdev-help-card-title">{t(`appdev.help.${key}Title`)}</h3>
                <p className="appdev-help-card-body">{t(`appdev.help.${key}Body`)}</p>
              </article>
            ))}
          </div>
          <p className="appdev-help-foot">{t('appdev.help.footer')}</p>
        </section>
      )}

      <button
        type="button"
        className={`appdev-help-fab${open ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}${pos ? ' is-ready' : ''}`}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        aria-label={open ? t('appdev.help.hide') : t('appdev.help.show')}
        title={open ? t('appdev.help.hide') : t('appdev.help.show')}
      >
        <Icon name="helpCircle" size={22} />
      </button>
    </>
  );
}
