'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { DEPARTMENTS, deptText, getDepartmentLandingPath } from '@/lib/internal';

export default function InternalDepartmentNav({ activeDepartmentId = null }) {
  const { t } = useLocale();

  return (
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
  );
}
