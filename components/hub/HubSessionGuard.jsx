'use client';

import { useEffect } from 'react';
import { useHubSession } from '@/components/hub/HubSessionProvider';

const SESSION_CHECK_MS = 45_000;

/** Poll hub session — sign out locally when the same account logs in elsewhere. */
export default function HubSessionGuard() {
  const session = useHubSession();
  const authEnabled = session?.authEnabled !== false;

  useEffect(() => {
    if (!authEnabled) return undefined;

    let cancelled = false;

    async function redirectForSignOut(reason = 'session_revoked') {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
      window.location.replace(`/?reason=${encodeURIComponent(reason)}`);
    }

    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me?scope=hub', { credentials: 'same-origin' });
        if (cancelled) return;
        if (!res.ok) {
          await redirectForSignOut('session_revoked');
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data.hub) {
          await redirectForSignOut(data.signOutReason || 'session_revoked');
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
  }, [authEnabled]);

  return null;
}
