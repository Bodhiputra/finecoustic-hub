'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';

const STORAGE_KEY = 'ops-hub-theme';

export default function ThemeToggle() {
  const { t } = useLocale();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const next = stored === 'light' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={t('common.toggleTheme')}>
      <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
      <span>{theme === 'dark' ? t('common.dark') : t('common.light')}</span>
    </button>
  );
}
