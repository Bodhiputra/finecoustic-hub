'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMessage, LOCALES, messages } from '@/lib/i18n/messages';
import { htmlLangForHub } from '@/lib/i18n/locale-intl';

const STORAGE_KEY = 'finehub-locale';

const LocaleContext = createContext(null);

function readStoredLocale() {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'id' || !LOCALES.includes(stored)) {
    if (stored && stored !== 'en') localStorage.setItem(STORAGE_KEY, 'en');
    return 'en';
  }
  return stored;
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = htmlLangForHub(locale);
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale, ready]);

  const setLocale = useCallback(next => {
    if (LOCALES.includes(next)) setLocaleState(next);
  }, []);

  const t = useCallback(path => getMessage(locale, path), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
