'use client';

import { createContext, useContext } from 'react';

const HubSessionContext = createContext(null);

export function HubSessionProvider({ initialProfile = null, authEnabled = true, children }) {
  return (
    <HubSessionContext.Provider value={{ initialProfile, authEnabled }}>
      {children}
    </HubSessionContext.Provider>
  );
}

export function useHubSession() {
  return useContext(HubSessionContext);
}

/** Server-seeded profile from hub layout — avoids duplicate /api/auth/me on first paint. */
export function useHubSessionProfile(fallback = null) {
  const session = useContext(HubSessionContext);
  return session?.initialProfile ?? fallback;
}
