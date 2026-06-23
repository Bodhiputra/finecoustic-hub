'use client';

import { LOCALE_LABELS, LOCALES } from '@/lib/i18n/messages';
import { useLocale } from '@/components/LocaleProvider';

export default function LocaleSwitch({ className = '' }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={`locale-switch ${className}`.trim()} role="group" aria-label={t('common.language')}>
      {LOCALES.map(code => (
        <button
          key={code}
          type="button"
          className={`locale-switch-btn${locale === code ? ' active' : ''}`}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
