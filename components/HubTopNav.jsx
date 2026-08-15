'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { HubMenuButton } from '@/components/HubSidebarContext';
import LocaleSwitch from '@/components/LocaleSwitch';
import ThemeToggle from '@/components/ThemeToggle';
import PresenceAvatars from '@/components/appdev/PresenceAvatars';
import HubNotifications from '@/components/internal/HubNotifications';
import UserAvatar from '@/components/internal/UserAvatar';
import { useHubPresence, useHubPresenceOnline } from '@/components/internal/useHubPresence';
import { useLocale } from '@/components/LocaleProvider';

export default function HubTopNav({
  title = '',
  subtitle = '',
  authEnabled = false,
  displayName: displayNameProp = '',
  onLogout,
}) {
  const { t } = useLocale();
  const [displayName, setDisplayName] = useState(displayNameProp);
  const { subscribe: subscribePresence } = useHubPresence(authEnabled);
  const onlineUsers = useHubPresenceOnline(subscribePresence);

  useEffect(() => {
    if (displayNameProp) {
      setDisplayName(displayNameProp);
      return;
    }
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.displayName) setDisplayName(data.displayName);
      })
      .catch(() => {});
  }, [displayNameProp]);

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
        <PresenceAvatars
          online={onlineUsers}
          currentUser={displayName}
          t={t}
          youLabel={t('hub.internal.you')}
        />
        <HubNotifications />
        <LocaleSwitch />
        <ThemeToggle />
        <Link href="/me" className="hub-topnav-user" aria-label={t('hub.internal.personalHub')}>
          <UserAvatar name={displayName} size={30} />
          <span className="hub-topnav-user-name">{displayName || t('hub.internal.personalHub')}</span>
        </Link>
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
