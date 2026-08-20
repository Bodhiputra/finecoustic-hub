'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import HubTopNav from '@/components/HubTopNav';
import { useLocale } from '@/components/LocaleProvider';

const MOBILE_MQ = '(max-width: 768px)';

const HubSidebarContext = createContext(null);

export function useHubSidebar() {
  return useContext(HubSidebarContext);
}

function useSidebarViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const sidebarId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useSidebarViewport();
  const open = layoutReady && (isMobile ? mobileOpen : true);

  useEffect(() => {
    setLayoutReady(true);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setMobileOpen(false);
  }, [pathname, searchParams, isMobile]);

  useEffect(() => {
    if (!open || !isMobile) return undefined;
    if (typeof window === 'undefined') return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, isMobile]);

  const toggle = () => {
    if (!isMobile) return;
    setMobileOpen(prev => !prev);
  };

  const close = () => {
    if (!isMobile) return;
    setMobileOpen(false);
  };

  const value = useMemo(
    () => ({
      open,
      sidebarId,
      toggle,
      close,
      isMobile,
    }),
    [open, sidebarId, isMobile]
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
        </aside>
        <div className="hub-main-shell">
          <HubTopNav
            title={topNavTitle}
            subtitle={topNavSubtitle}
            authEnabled={authEnabled}
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
