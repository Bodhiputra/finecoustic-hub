'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { ABOUT_FINEACOUSTIC, getAboutFinecousticLandingPath } from '@/lib/internal';
import { HOME_TAB } from '@/lib/home-tabs';

function FinecousticWikiHomeLink({ className = '', active = false }) {
  const { t } = useLocale();

  return (
    <div className={`internal-sidebar-wiki-footer internal-sidebar-wiki-home-link${className ? ` ${className}` : ''}`}>
      <nav className="sidebar-nav" aria-label={t('hub.internal.allAboutFinecoustic')}>
        <Link
          href={getAboutFinecousticLandingPath()}
          className={`nav${active ? ' active' : ''}`}
          aria-current={active ? 'page' : undefined}
          title={t('hub.wiki.subtitle')}
        >
          <Icon name={ABOUT_FINEACOUSTIC.icon} size={15} />
          <span className="nav-label">{t('hub.internal.allAboutFinecoustic')}</span>
        </Link>
      </nav>
    </div>
  );
}

function FinecousticWikiHomeCompactLink({ onHomeTabChange, active = false, className = '' }) {
  const { t } = useLocale();

  return (
    <div className={`internal-sidebar-wiki-footer internal-sidebar-wiki-home-link${className ? ` ${className}` : ''}`}>
      <nav className="sidebar-nav" aria-label={t('hub.internal.allAboutFinecoustic')}>
        <button
          type="button"
          className={`nav${active ? ' active' : ''}`}
          aria-current={active ? 'page' : undefined}
          title={t('hub.wiki.subtitle')}
          onClick={() => onHomeTabChange(HOME_TAB.WIKI, { pageId: '' })}
        >
          <Icon name={ABOUT_FINEACOUSTIC.icon} size={15} />
          <span className="nav-label">{t('hub.internal.allAboutFinecoustic')}</span>
        </button>
      </nav>
    </div>
  );
}

export default function FinecousticWikiSidebarSection({
  variant = 'home',
  className = '',
  homeTab = null,
  onHomeTabChange = null,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wikiActive = variant === 'home' && typeof onHomeTabChange === 'function'
    ? homeTab === HOME_TAB.WIKI
    : pathname === '/' && searchParams.get('wiki') === '1';

  if (variant === 'home' && typeof onHomeTabChange === 'function') {
    return (
      <FinecousticWikiHomeCompactLink
        onHomeTabChange={onHomeTabChange}
        active={wikiActive}
        className={className}
      />
    );
  }

  return <FinecousticWikiHomeLink active={wikiActive} className={className} />;
}
