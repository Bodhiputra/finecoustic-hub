'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import {
  ABOUT_FINEACOUSTIC,
  DEPARTMENTS,
  deptText,
  getAboutFinecousticLandingPath,
  getDepartmentLandingPath,
} from '@/lib/internal';

export default function InternalDepartmentNav({ activeDepartmentId = null }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const aboutActive = pathname === ABOUT_FINEACOUSTIC.path || activeDepartmentId === ABOUT_FINEACOUSTIC.id;

  return (
    <>
      <div className="internal-sidebar-section internal-sidebar-about">
        <small>{t('hub.internal.allAboutFinecoustic')}</small>
        <nav className="sidebar-nav" aria-label={t('hub.internal.allAboutFinecoustic')}>
          <Link
            href={getAboutFinecousticLandingPath()}
            className={`nav${aboutActive ? ' active' : ''}`}
            aria-current={aboutActive ? 'page' : undefined}
            title={t('hub.internal.allAboutFinecoustic')}
          >
            <Icon name={ABOUT_FINEACOUSTIC.icon} size={15} />
            <span className="nav-label">{t('hub.internal.allAboutFinecoustic')}</span>
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
    </>
  );
}
