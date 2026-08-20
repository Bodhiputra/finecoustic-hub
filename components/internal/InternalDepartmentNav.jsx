'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import FinecousticWikiSidebarSection from '@/components/wiki/FinecousticWikiSidebarSection';
import { useLocale } from '@/components/LocaleProvider';
import {
  CAMPAIGNS_PATH,
  DEPARTMENTS,
  deptText,
  getDepartmentLandingPath,
} from '@/lib/internal';
import { isFinecousticWikiHomeView } from '@/lib/knowledge';
import { departmentsVisibleToUser } from '@/lib/hub-departments';
import { campaignListHomeUrl, isCampaignHomeTab } from '@/lib/campaign-urls';
import { requestHubLoaderForNavigation } from '@/lib/hub-site-loader';
import { useHubSessionProfile } from '@/hooks/useHubSession';
import { HOME_TAB } from '@/lib/home-tabs';

export default function InternalDepartmentNav({
  activeDepartmentId = null,
  initialWikiPages = null,
  initialHubUser = null,
  homeTab = null,
  onHomeTabChange = null,
  wikiPageId = '',
  accountDisplayName = '',
}) {
  const { t } = useLocale();
  const sessionProfile = useHubSessionProfile();
  const seededHubUser = initialHubUser ?? sessionProfile?.hubUser ?? null;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [departmentAccess, setDepartmentAccess] = useState(
    () => seededHubUser?.permissions?.departmentAccess || seededHubUser?.departmentAccess || null
  );
  const [isAdmin, setIsAdmin] = useState(() => Boolean(seededHubUser?.isAdmin));
  const [canManageUsers, setCanManageUsers] = useState(() =>
    Boolean(seededHubUser?.permissions?.canManageUsers)
  );
  const [accessResolved, setAccessResolved] = useState(() => Boolean(seededHubUser));
  const clientHomeTabs = pathname === '/' && typeof onHomeTabChange === 'function';
  const campaignsListOnHome = clientHomeTabs
    ? homeTab === HOME_TAB.CAMPAIGNS
    : pathname === '/' && isCampaignHomeTab(searchParams);
  const onCampaignWorkspace =
    pathname === CAMPAIGNS_PATH
    && Boolean(searchParams.get('flow') || searchParams.get('board'));
  const campaignNavActive = campaignsListOnHome || onCampaignWorkspace;
  const scheduleNavActive = clientHomeTabs
    ? homeTab === HOME_TAB.SCHEDULE
    : pathname === '/'
      && !campaignsListOnHome
      && !isFinecousticWikiHomeView(searchParams);

  useEffect(() => {
    if (seededHubUser) {
      const access =
        seededHubUser.permissions?.departmentAccess
        || seededHubUser.departmentAccess
        || null;
      setDepartmentAccess(access);
      setIsAdmin(Boolean(seededHubUser.isAdmin));
      setCanManageUsers(Boolean(seededHubUser.permissions?.canManageUsers));
      setAccessResolved(true);
      return;
    }
    fetch('/api/auth/me?scope=hub', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const access =
          data?.hubUser?.permissions?.departmentAccess
          || data?.hubUser?.departmentAccess
          || null;
        setDepartmentAccess(access);
        setIsAdmin(Boolean(data?.hubUser?.isAdmin));
        setCanManageUsers(Boolean(data?.hubUser?.permissions?.canManageUsers));
      })
      .catch(() => {})
      .finally(() => setAccessResolved(true));
  }, [seededHubUser?.id, seededHubUser?.permissions?.canManageUsers]);

  const visibleDepartments = departmentsVisibleToUser(
    { isAdmin, departmentAccess, accessResolved },
    DEPARTMENTS
  );

  const personalSectionLabel =
    (accountDisplayName || sessionProfile?.displayName || '').trim()
    || t('hub.personal.sectionYou');

  return (
    <div className="internal-sidebar-home-nav">
      <div className="internal-sidebar-home-nav-main">
        <div className="internal-sidebar-section internal-sidebar-personal">
          <small>{personalSectionLabel}</small>
          <nav className="sidebar-nav" aria-label={personalSectionLabel}>
            <Link
              href="/me"
              className={`nav${pathname === '/me' ? ' active' : ''}`}
              aria-current={pathname === '/me' ? 'page' : undefined}
              title={t('hub.personal.navHint')}
              onClick={() => requestHubLoaderForNavigation(pathname, '/me')}
            >
              <Icon name="user" size={15} />
              <span className="nav-label">{t('hub.personal.navLabel')}</span>
            </Link>
            {canManageUsers ? (
              <Link
                href="/hub/admin"
                className={`nav${pathname === '/hub/admin' ? ' active' : ''}`}
                aria-current={pathname === '/hub/admin' ? 'page' : undefined}
                title={t('hub.admin.teamMembersHint')}
              >
                <Icon name="users" size={15} />
                <span className="nav-label">{t('hub.admin.teamMembers')}</span>
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="internal-sidebar-section internal-sidebar-work">
          <small>{t('hub.internal.sectionWork')}</small>
          <nav className="sidebar-nav" aria-label={t('hub.internal.sectionWork')}>
            {clientHomeTabs ? (
              <button
                type="button"
                className={`nav${scheduleNavActive ? ' active' : ''}`}
                aria-current={scheduleNavActive ? 'page' : undefined}
                title={t('hub.internal.teamScheduleHint')}
                onClick={() => onHomeTabChange(HOME_TAB.SCHEDULE)}
              >
                <Icon name="calendar" size={15} />
                <span className="nav-label">{t('hub.internal.scheduleDashboard')}</span>
              </button>
            ) : (
              <Link
                href="/"
                className={`nav${scheduleNavActive ? ' active' : ''}`}
                aria-current={scheduleNavActive ? 'page' : undefined}
                title={t('hub.internal.teamScheduleHint')}
              >
                <Icon name="calendar" size={15} />
                <span className="nav-label">{t('hub.internal.scheduleDashboard')}</span>
              </Link>
            )}
            {clientHomeTabs ? (
              <button
                type="button"
                className={`nav${campaignNavActive ? ' active' : ''}`}
                aria-current={campaignsListOnHome ? 'page' : undefined}
                title={t('hub.internal.campaignList')}
                onClick={() => onHomeTabChange(HOME_TAB.CAMPAIGNS)}
              >
                <Icon name="megaphone" size={15} />
                <span className="nav-label">{t('hub.internal.campaignList')}</span>
              </button>
            ) : (
              <Link
                href={campaignListHomeUrl()}
                className={`nav${campaignNavActive ? ' active' : ''}`}
                aria-current={campaignsListOnHome ? 'page' : undefined}
                title={t('hub.internal.campaignList')}
              >
                <Icon name="megaphone" size={15} />
                <span className="nav-label">{t('hub.internal.campaignList')}</span>
              </Link>
            )}
          </nav>
        </div>

        {visibleDepartments.length > 0 ? (
        <div className="internal-sidebar-section internal-sidebar-departments">
          <small>{t('hub.internal.departments')}</small>
          <nav className="sidebar-nav" aria-label={t('hub.internal.departments')}>
            {visibleDepartments.map(d => {
              const deptHref = getDepartmentLandingPath(d.id);
              return (
              <Link
                key={d.id}
                href={deptHref}
                className={`nav${activeDepartmentId === d.id ? ' active' : ''}`}
                aria-current={activeDepartmentId === d.id ? 'page' : undefined}
                title={deptText(d, t, 'label')}
                onClick={() => requestHubLoaderForNavigation(pathname, deptHref)}
              >
                <Icon name={d.icon} size={15} />
                <span className="nav-label">{deptText(d, t, 'label')}</span>
              </Link>
              );
            })}
          </nav>
        </div>
        ) : null}
      </div>

      <FinecousticWikiSidebarSection
        variant="home"
        initialPages={initialWikiPages}
        homeTab={homeTab}
        onHomeTabChange={onHomeTabChange}
        wikiPageId={wikiPageId}
      />
    </div>
  );
}
