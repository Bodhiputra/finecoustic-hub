'use client';

import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import LocaleSwitch from '@/components/LocaleSwitch';
import ThemeToggle from '@/components/ThemeToggle';
import { useLocale } from '@/components/LocaleProvider';

const MODULE_IDS = ['operations', 'design', 'knowledge', 'projects'];

const MODULE_META = {
  operations: { href: '/ops', status: 'active', icon: 'box' },
  design: { href: null, status: 'soon', icon: 'layout' },
  knowledge: { href: null, status: 'soon', icon: 'book' },
  projects: { href: null, status: 'soon', icon: 'kanban' },
};

export default function HubHome({ authEnabled }) {
  const { t } = useLocale();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <div className="hub-page">
      <header className="hub-header">
        <div className="hub-brand">
          <Image className="brand-logo" src="/FLogo.png" alt="Finecoustic" width={36} height={36} />
          <div>
            <strong>{t('hub.name')}</strong>
            <small>{t('hub.tagline')}</small>
          </div>
        </div>
        <div className="hub-header-actions">
          <LocaleSwitch />
          <ThemeToggle />
          {authEnabled && (
            <button type="button" className="btn-ghost" onClick={handleLogout}>
              <Icon name="logOut" size={15} />
              {t('common.signOut')}
            </button>
          )}
        </div>
      </header>

      <main className="hub-main">
        <div className="hub-intro">
          <h1>{t('hub.heading')}</h1>
          <p>{t('hub.subheading')}</p>
        </div>

        <div className="hub-grid">
          {MODULE_IDS.map(id => {
            const meta = MODULE_META[id];
            const card = (
              <>
                <div className="hub-card-icon" aria-hidden="true">
                  <Icon name={meta.icon} size={18} />
                </div>
                <div className="hub-card-head">
                  <h2>{t(`hub.modules.${id}.title`)}</h2>
                  {meta.status === 'soon' && <span className="hub-badge">{t('common.comingSoon')}</span>}
                </div>
                <p>{t(`hub.modules.${id}.description`)}</p>
              </>
            );

            if (meta.status === 'active' && meta.href) {
              return (
                <Link key={id} href={meta.href} className="hub-card hub-card-active">
                  {card}
                </Link>
              );
            }

            return (
              <div key={id} className="hub-card hub-card-disabled" aria-disabled="true">
                {card}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
