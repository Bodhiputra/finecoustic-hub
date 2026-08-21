'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import { HubMenuButton } from '@/components/HubSidebarContext';
import LocaleSwitch from '@/components/LocaleSwitch';
import ThemeToggle from '@/components/ThemeToggle';
import HubNotifications from '@/components/internal/HubNotifications';
import UserAvatar from '@/components/internal/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { useHubSessionProfile } from '@/hooks/useHubSession';
import { requestHubLoaderForNavigation } from '@/lib/hub-site-loader';

export default function HubTopNav({
  title = '',
  subtitle = '',
  authEnabled = false,
  displayName: displayNameProp = '',
  onLogout,
}) {
  const { t } = useLocale();
  const pathname = usePathname();
  const sessionProfile = useHubSessionProfile();
  const displayName = (displayNameProp || sessionProfile?.displayName || '').trim();
  const personalActive = pathname === '/me' || pathname.startsWith('/me/');

  async function handleLogout() {
    if (onLogout) {
      onLogout();
      return;
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <header className="hub-topnav">
      <div className="hub-topnav-start">
        <HubMenuButton />
        {(title || subtitle) && (
          <div className="hub-topnav-titles">
            {title ? <h1 className="hub-topnav-title">{title}</h1> : null}
            {subtitle ? <p className="hub-topnav-subtitle">{subtitle}</p> : null}
          </div>
        )}
      </div>
      <div className="hub-topnav-actions">
        <HubNotifications />
        <LocaleSwitch />
        <ThemeToggle />
        {authEnabled ? (
          <Link
            href="/me"
            className={`hub-topnav-user${personalActive ? ' is-active' : ''}`}
            aria-label={t('hub.internal.personalHub')}
            aria-current={personalActive ? 'page' : undefined}
            onClick={() => requestHubLoaderForNavigation(pathname, '/me')}
          >
            <UserAvatar name={displayName} size={30} />
            <span className="hub-topnav-user-name">
              {displayName || t('hub.internal.personalHub')}
            </span>
          </Link>
        ) : null}
        {authEnabled && (
          <button type="button" className="btn-ghost hub-topnav-signout" onClick={handleLogout}>
            <Icon name="logOut" size={15} />
            <span>{t('common.signOut')}</span>
          </button>
        )}
      </div>
    </header>
  );
}
