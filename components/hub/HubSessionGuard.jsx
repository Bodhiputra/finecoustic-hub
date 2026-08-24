'use client';

import { useEffect } from 'react';
import { useHubSession } from '@/components/hub/HubSessionProvider';

const SESSION_CHECK_MS = 45_000;

function isLoginPath() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path === '/' || path === '/login';
}

/** Poll hub session — sign out locally when the same account logs in elsewhere. */
export default function HubSessionGuard() {
  const session = useHubSession();
  const authEnabled = session?.authEnabled !== false;
  const hasActiveSession = Boolean(session?.initialProfile?.displayName);

  useEffect(() => {
    // Never poll on the login screen — avoids refresh loops while signed out or during build errors.
    if (!authEnabled || !hasActiveSession || isLoginPath()) return undefined;

    let cancelled = false;

    async function redirectForSignOut(reason = 'session_revoked') {
      if (reason === 'unauthorized') return;
      if (isLoginPath()) return;

      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
      window.location.replace(`/?reason=${encodeURIComponent(reason)}`);
    }

    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me?scope=hub', { credentials: 'same-origin' });
        if (cancelled) return;

        // Server/build errors are not session expiry — do not force logout.
        if (!res.ok) {
          if (res.status >= 500) return;
          await redirectForSignOut('session_revoked');
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!data.hub) {
          const reason = data.signOutReason || 'session_revoked';
          await redirectForSignOut(reason);
        }
      } catch {
        /* ignore transient network errors */
      }
    }

    const startupId = window.setTimeout(checkSession, 2000);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') checkSession();
    }, SESSION_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkSession();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(startupId);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authEnabled, hasActiveSession]);

  return null;
}
