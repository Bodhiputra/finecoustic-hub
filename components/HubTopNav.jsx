'use client';

import Icon from '@/components/Icon';
import { HubMenuButton } from '@/components/HubSidebarContext';
import LocaleSwitch from '@/components/LocaleSwitch';
import ThemeToggle from '@/components/ThemeToggle';
import HubNotifications from '@/components/internal/HubNotifications';
import { useLocale } from '@/components/LocaleProvider';

export default function HubTopNav({
  title = '',
  subtitle = '',
  authEnabled = false,
  onLogout,
}) {
  const { t } = useLocale();

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
          </div>
        )}
      </div>
      <div className="hub-topnav-actions">
        <HubNotifications />
        <LocaleSwitch />
        <ThemeToggle />
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
