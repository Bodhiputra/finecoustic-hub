'use client';

import { useEffect } from 'react';
import HubErrorFallback from '@/components/HubErrorFallback';

export default function HubError({ error, reset }) {
  useEffect(() => {
    console.error('[HubError]', error);
  }, [error]);

  return <HubErrorFallback onRetry={reset} />;
}
