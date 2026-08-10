'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import HubTopNav from '@/components/HubTopNav';
import { useLocale } from '@/components/LocaleProvider';

const STORAGE_KEY = 'hub-sidebar-open';
const MOBILE_MQ = '(max-width: 768px)';

const HubSidebarContext = createContext(null);

export function useHubSidebar() {
  return useContext(HubSidebarContext);
}

function useSidebarViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(MOBILE_MQ);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}

function HubSidebarCollapseRail() {
  const ctx = useHubSidebar();
  const { t } = useLocale();
  if (!ctx?.open) return null;

  const label = t('hub.internal.minimizeSidebar');

  return (
    <button
      type="button"
      className="hub-sidebar-rail"
      onClick={ctx.close}
      aria-label={label}
      title={label}
    >
      <Icon name="chevronLeft" size={16} />
    </button>
  );
}

function HubSidebarExpandTab() {
  const ctx = useHubSidebar();
  const { t } = useLocale();
  if (!ctx || ctx.open) return null;

  const label = t('hub.internal.expandSidebar');

  return (
    <button
      type="button"
      className="hub-sidebar-expand-tab"
      onClick={ctx.toggle}
      aria-label={label}
      title={label}
    >
      <Icon name="chevronRight" size={16} />
      <span className="hub-sidebar-expand-tab-label">{label}</span>
    </button>
  );
}

function HubSidebarMobileDone() {
  const ctx = useHubSidebar();
  const { t } = useLocale();
  if (!ctx?.open) return null;

  const label = t('hub.internal.backToContent');

  return (
    <button type="button" className="hub-sidebar-mobile-done" onClick={ctx.close}>
      <Icon name="chevronLeft" size={18} />
      <span>{label}</span>
    </button>
  );
}

export function HubLayout({
  sidebar,
  sidebarLabel = 'Navigation',
  className = '',
  sidebarClassName = '',
  topNavTitle = '',
  topNavSubtitle = '',
  authEnabled = false,
  displayName = '',
  onLogout,
  children,
}) {
  const [open, setOpen] = useState(false);
  const sidebarId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useSidebarViewport();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mobile = window.matchMedia('(max-width: 768px)').matches; /* --bp-md */
    if (mobile) {
      setOpen(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setOpen(stored === '1');
      else setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(max-width: 768px)').matches) {
      setOpen(false);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!open) return undefined;
    if (typeof window === 'undefined') return undefined;
    if (!window.matchMedia('(max-width: 768px)').matches) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    setOpen(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, '0');
    } catch {
      /* ignore */
    }
  };

  const value = useMemo(
    () => ({
      open,
      sidebarId,
      toggle,
      close,
    }),
    [open, sidebarId]
  );

  return (
    <HubSidebarContext.Provider value={value}>
      <div
        className={[
          'layout hub-layout',
          open ? 'is-sidebar-open' : '',
          className,
        ].filter(Boolean).join(' ')}
      >
        <button
          type="button"
          className="hub-sidebar-backdrop"
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          onClick={close}
        />
        <aside
          id={sidebarId}
          className={[
            'sidebar hub-sidebar',
            open ? 'is-open' : '',
            sidebarClassName,
          ].filter(Boolean).join(' ')}
          aria-label={sidebarLabel}
        >
          <div className="hub-sidebar-inner">{sidebar}</div>
          {!isMobile && open ? <HubSidebarCollapseRail /> : null}
          {isMobile ? <HubSidebarMobileDone /> : null}
        </aside>
        {!isMobile && !open ? <HubSidebarExpandTab /> : null}
        <div className="hub-main-shell">
          <HubTopNav
            title={topNavTitle}
            subtitle={topNavSubtitle}
            authEnabled={authEnabled}
            displayName={displayName}
            onLogout={onLogout}
          />
          {children}
        </div>
      </div>
    </HubSidebarContext.Provider>
  );
}

export function HubMenuButton({ label }) {
  const ctx = useHubSidebar();
  const { t } = useLocale();
  const isMobile = useSidebarViewport();
  if (!ctx) return null;

  const { open, toggle, sidebarId } = ctx;

  // Desktop: edge rail + expand tab handle show/hide — no top-nav toggle.
  if (!isMobile) return null;

  const buttonLabel = label || (open ? t('hub.internal.backToContent') : t('hub.internal.openSidebar'));

  return (
    <button
      type="button"
      className={`hub-menu-btn${open ? ' is-open' : ''}`}
      onClick={toggle}
      aria-expanded={open}
      aria-controls={sidebarId}
      aria-label={buttonLabel}
      title={buttonLabel}
    >
      <Icon name={open ? 'chevronLeft' : 'menu'} size={20} />
    </button>
  );
}
