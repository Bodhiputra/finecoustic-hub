'use client';

import { LocaleProvider } from '@/components/LocaleProvider';

export default function Providers({ children }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}
