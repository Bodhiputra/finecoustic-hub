'use client';

import { useEffect } from 'react';
import HubErrorFallback from '@/components/HubErrorFallback';

export default function RootError({ error, reset }) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return <HubErrorFallback onRetry={reset} />;
}
