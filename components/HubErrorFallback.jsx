'use client';

import Icon from '@/components/Icon';
import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';

export default function HubErrorFallback({ onRetry }) {
  const { t } = useLocale();

  return (
    <div className="hub-error-page">
      <div className="hub-error-card">
        <div className="hub-error-icon" aria-hidden="true">
          <Icon name="alertTriangle" size={28} />
        </div>
        <h1>{t('hub.error.title')}</h1>
        <p>{t('hub.error.description')}</p>
        <div className="hub-error-actions">
          {onRetry ? (
            <button type="button" className="appdev-btn-primary" onClick={onRetry}>
              {t('hub.error.retry')}
            </button>
          ) : null}
          <Link href="/" className="appdev-btn-ghost">
            {t('hub.error.home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
