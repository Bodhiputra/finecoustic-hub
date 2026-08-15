'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import FinecousticWikiSidebarSection from '@/components/wiki/FinecousticWikiSidebarSection';
import { useLocale } from '@/components/LocaleProvider';
import {
  CAMPAIGNS_PATH,
  DEPARTMENTS,
  deptText,
  getDepartmentLandingPath,
} from '@/lib/internal';

export default function InternalDepartmentNav({ activeDepartmentId = null }) {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <div className="internal-sidebar-home-nav">
      <div className="internal-sidebar-home-nav-main">
        <div className="internal-sidebar-section internal-sidebar-work">
          <small>{t('hub.internal.sectionWork')}</small>
          <nav className="sidebar-nav" aria-label={t('hub.internal.sectionWork')}>
            <Link
              href={CAMPAIGNS_PATH}
              className={`nav${pathname === CAMPAIGNS_PATH || pathname.startsWith(`${CAMPAIGNS_PATH}/`) ? ' active' : ''}`}
              aria-current={pathname === CAMPAIGNS_PATH ? 'page' : undefined}
              title={t('hub.internal.campaignList')}
            >
              <Icon name="megaphone" size={15} />
              <span className="nav-label">{t('hub.internal.campaignList')}</span>
            </Link>
          </nav>
        </div>

        <div className="internal-sidebar-section internal-sidebar-departments">
          <small>{t('hub.internal.departments')}</small>
          <nav className="sidebar-nav" aria-label={t('hub.internal.departments')}>
            {DEPARTMENTS.map(d => (
              <Link
                key={d.id}
                href={getDepartmentLandingPath(d.id)}
                className={`nav${activeDepartmentId === d.id ? ' active' : ''}`}
                aria-current={activeDepartmentId === d.id ? 'page' : undefined}
                title={deptText(d, t, 'label')}
              >
                <Icon name={d.icon} size={15} />
                <span className="nav-label">{deptText(d, t, 'label')}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <FinecousticWikiSidebarSection variant="home" />
    </div>
  );
}
