'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const HEARTBEAT_MS = 45_000;
const STARTUP_DELAY_MS = 4_000;

export function useAppdevPresence(enabled = true) {
  const onlineRef = useRef([]);
  const listenersRef = useRef(new Set());

  const notify = useCallback(list => {
    onlineRef.current = list;
    for (const fn of listenersRef.current) fn(list);
  }, []);

  const heartbeat = useCallback(async () => {
    try {
      const res = await fetch('/api/appdev/presence', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.online)) notify(data.online);
    } catch {
      /* ignore */
    }
  }, [notify]);

  useEffect(() => {
    if (!enabled) return;

    const startupId = window.setTimeout(heartbeat, STARTUP_DELAY_MS);
    const heartbeatId = window.setInterval(heartbeat, HEARTBEAT_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') heartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(startupId);
      window.clearInterval(heartbeatId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, heartbeat]);

  const subscribe = useCallback(fn => {
    listenersRef.current.add(fn);
    fn(onlineRef.current);
    return () => listenersRef.current.delete(fn);
  }, []);

  return { subscribe, refresh: heartbeat };
}

export function usePresenceOnline(subscribe) {
  const [online, setOnline] = useState([]);
  useEffect(() => subscribe(setOnline), [subscribe]);
  return online;
}
