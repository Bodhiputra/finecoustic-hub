'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import HubTopNav from '@/components/HubTopNav';
import { useLocale } from '@/components/LocaleProvider';

const STORAGE_KEY = 'hub-sidebar-open';

const HubSidebarContext = createContext(null);

export function useHubSidebar() {
  return useContext(HubSidebarContext);
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
  const [open, setOpen] = useState(true);
  const sidebarId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setOpen(stored === '1');
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
        </aside>
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
  if (!ctx) return null;

  const { open, toggle, sidebarId } = ctx;
  const buttonLabel = label || (open ? t('hub.warzone.closeSidebar') : t('hub.warzone.openSidebar'));

  return (
    <button
      type="button"
      className="hub-menu-btn"
      onClick={toggle}
      aria-expanded={open}
      aria-controls={sidebarId}
      aria-label={buttonLabel}
      title={buttonLabel}
    >
      <Icon name={open ? 'x' : 'menu'} size={20} />
    </button>
  );
}
