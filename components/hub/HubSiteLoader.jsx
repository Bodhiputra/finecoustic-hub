'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  HUB_LOADER_EXIT_MS,
  HUB_LOADER_FONT_WAIT_MS,
  HUB_LOADER_MAX_NAV_MS,
  HUB_LOADER_MIN_VISIBLE_MS,
  HUB_LOADER_NAV_EVENT,
  HUB_LOADER_NAV_READY_EVENT,
  HUB_LOADER_SEEN_KEY,
  HUB_LOADER_TAGLINE_HOME,
  hubDepartmentIdFromPathname,
  hubLoaderTaglineForDepartment,
  hubLoaderTaglineForPathname,
} from '@/lib/hub-site-loader';

function shouldSkipFirstVisitLoader() {
  if (typeof window === 'undefined') return true;
  try {
    if (!document.documentElement.classList.contains('hub-site-loader-pending')) return true;
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload') return true;
    if (sessionStorage.getItem(HUB_LOADER_SEEN_KEY) === '1') return true;
  } catch {
    return true;
  }
  return false;
}

function markFirstVisitSeen() {
  try {
    sessionStorage.setItem(HUB_LOADER_SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function HubLoaderSplash({ tagline = HUB_LOADER_TAGLINE_HOME, className = '' }) {
  return (
    <div className={`hub-site-loader-splash${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      <img
        className="hub-site-loader__logo"
        src="/FLogo-mark-yellow.svg"
        alt=""
        width={40}
        height={40}
        decoding="async"
      />
      <p className="hub-site-loader__tagline">{tagline}</p>
    </div>
  );
}

export default function HubSiteLoader() {
  const pathname = usePathname();
  const prevPathRef = useRef(null);
  const prevDeptRef = useRef(null);
  const skipPathLoaderDeptRef = useRef(null);
  const startedAtRef = useRef(0);
  const exitTimerRef = useRef(null);
  const navPendingRef = useRef(null);
  const [tagline, setTagline] = useState(HUB_LOADER_TAGLINE_HOME);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('idle');

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const finishLoader = useCallback((markSeen = false) => {
    clearExitTimer();
    navPendingRef.current = null;
    if (markSeen) markFirstVisitSeen();
    setVisible(false);
    setPhase('idle');
    document.documentElement.classList.remove(
      'hub-site-loader-pending',
      'hub-site-loader-active',
      'hub-site-loader-revealing'
    );
  }, [clearExitTimer]);

  const beginExit = useCallback((markSeen = false) => {
    const root = document.documentElement;
    root.classList.remove('hub-site-loader-pending');
    root.classList.add('hub-site-loader-revealing');
    setPhase('exiting');

    const loader = document.getElementById('hub-site-loader');
    let done = false;

    function complete() {
      if (done) return;
      done = true;
      loader?.removeEventListener('transitionend', onTransitionEnd);
      finishLoader(markSeen);
    }

    function onTransitionEnd(event) {
      if (event.target !== loader || event.propertyName !== 'opacity') return;
      complete();
    }

    loader?.addEventListener('transitionend', onTransitionEnd);
    exitTimerRef.current = window.setTimeout(complete, HUB_LOADER_EXIT_MS + 120);
  }, [finishLoader, clearExitTimer]);

  const scheduleTimedExit = useCallback((markFirstVisit = false) => {
    const scheduleExit = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const wait = Math.max(0, HUB_LOADER_MIN_VISIBLE_MS - elapsed);
      exitTimerRef.current = window.setTimeout(() => beginExit(markFirstVisit), wait);
    };

    if (document.fonts?.ready) {
      Promise.race([
        document.fonts.ready,
        new Promise(resolve => window.setTimeout(resolve, HUB_LOADER_FONT_WAIT_MS)),
      ]).then(scheduleExit);
    } else {
      scheduleExit();
    }
  }, [beginExit]);

  const tryCompleteNav = useCallback(() => {
    const pending = navPendingRef.current;
    if (!pending) return;
    if (pending.waitingPath || pending.waitingReady) return;

    clearExitTimer();
    const elapsed = Date.now() - pending.startedAt;
    const wait = Math.max(0, HUB_LOADER_MIN_VISIBLE_MS - elapsed);
    const markFirstVisit = pending.markFirstVisit;
    navPendingRef.current = null;
    exitTimerRef.current = window.setTimeout(() => beginExit(markFirstVisit), wait);
  }, [beginExit, clearExitTimer]);

  const beginNavPendingLoader = useCallback((nextTagline, {
    deptId = null,
    markFirstVisit = false,
    pathAlreadyUpdated = false,
  } = {}) => {
    clearExitTimer();
    setTagline(nextTagline);
    setVisible(true);
    setPhase('idle');
    startedAtRef.current = Date.now();
    if (deptId) skipPathLoaderDeptRef.current = deptId;
    document.documentElement.classList.add('hub-site-loader-active');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase('entering');
      });
    });

    navPendingRef.current = {
      deptId,
      waitingPath: Boolean(deptId && !pathAlreadyUpdated),
      waitingReady: true,
      startedAt: startedAtRef.current,
      markFirstVisit,
    };

    exitTimerRef.current = window.setTimeout(() => {
      navPendingRef.current = null;
      beginExit(markFirstVisit);
    }, HUB_LOADER_MAX_NAV_MS);
  }, [beginExit, clearExitTimer]);

  const runLoader = useCallback((nextTagline, {
    markFirstVisit = false,
    deptId = null,
    waitForNavComplete = false,
    pathAlreadyUpdated = false,
  } = {}) => {
    if (waitForNavComplete) {
      beginNavPendingLoader(nextTagline, { deptId, markFirstVisit, pathAlreadyUpdated });
      return;
    }

    clearExitTimer();
    navPendingRef.current = null;
    setTagline(nextTagline);
    setVisible(true);
    setPhase('idle');
    startedAtRef.current = Date.now();
    if (deptId) skipPathLoaderDeptRef.current = deptId;
    document.documentElement.classList.add('hub-site-loader-active');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase('entering');
      });
    });

    scheduleTimedExit(markFirstVisit);
  }, [beginNavPendingLoader, clearExitTimer, scheduleTimedExit]);

  const markNavPathArrived = useCallback(deptId => {
    const pending = navPendingRef.current;
    if (!pending || pending.deptId !== deptId) return;
    pending.waitingPath = false;
    tryCompleteNav();
  }, [tryCompleteNav]);

  useLayoutEffect(() => {
    if (shouldSkipFirstVisitLoader()) {
      document.documentElement.classList.remove('hub-site-loader-pending');
      return;
    }

    const nextTagline = hubLoaderTaglineForPathname(pathname);
    runLoader(nextTagline, { markFirstVisit: true });
    prevPathRef.current = pathname;
    prevDeptRef.current = hubDepartmentIdFromPathname(pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- first paint only
  }, []);

  useEffect(() => {
    function onNavLoader(event) {
      const detail = event?.detail;
      if (!detail?.tagline) return;
      runLoader(detail.tagline, { deptId: detail.deptId || null, waitForNavComplete: true });
    }
    window.addEventListener(HUB_LOADER_NAV_EVENT, onNavLoader);
    return () => window.removeEventListener(HUB_LOADER_NAV_EVENT, onNavLoader);
  }, [runLoader]);

  useEffect(() => {
    function onNavReady() {
      const pending = navPendingRef.current;
      if (!pending) return;
      pending.waitingReady = false;
      tryCompleteNav();
    }
    window.addEventListener(HUB_LOADER_NAV_READY_EVENT, onNavReady);
    return () => window.removeEventListener(HUB_LOADER_NAV_READY_EVENT, onNavReady);
  }, [tryCompleteNav]);

  useEffect(() => {
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname;
      prevDeptRef.current = hubDepartmentIdFromPathname(pathname);
      return;
    }

    if (prevPathRef.current === pathname) return;

    const nextDept = hubDepartmentIdFromPathname(pathname);
    const prevDept = prevDeptRef.current;

    if (nextDept && nextDept !== prevDept) {
      if (skipPathLoaderDeptRef.current === nextDept || navPendingRef.current?.deptId === nextDept) {
        skipPathLoaderDeptRef.current = null;
        markNavPathArrived(nextDept);
      } else {
        runLoader(hubLoaderTaglineForDepartment(nextDept), {
          deptId: nextDept,
          waitForNavComplete: true,
          pathAlreadyUpdated: true,
        });
      }
    }

    prevPathRef.current = pathname;
    prevDeptRef.current = nextDept;
  }, [pathname, runLoader, markNavPathArrived]);

  useEffect(() => () => clearExitTimer(), [clearExitTimer]);

  const className = [
    'hub-site-loader',
    visible ? 'is-visible' : '',
    phase === 'entering' ? 'is-entering' : '',
    phase === 'exiting' ? 'is-exiting' : '',
  ].filter(Boolean).join(' ');

  return (
    <div id="hub-site-loader-root">
      <div
        id="hub-site-loader"
        className={className}
        aria-hidden={!visible}
        aria-live="polite"
        aria-label="Loading Fine Teams"
      >
        <div className="hub-site-loader__inner">
          <img
            className="hub-site-loader__logo"
            src="/FLogo-mark-yellow.svg"
            alt=""
            width={40}
            height={40}
            decoding="sync"
          />
          <p id="hub-site-loader-tagline" className="hub-site-loader__tagline">
            {tagline}
          </p>
        </div>
      </div>
    </div>
  );
}
