'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { DEPARTMENTS, deptText, getDepartmentPath } from '@/lib/warzone';

export default function WarzoneDepartmentNav({ activeDepartmentId = null }) {
  const { t } = useLocale();

  return (
    <div className="warzone-sidebar-section warzone-sidebar-departments">
      <small>{t('hub.warzone.departments')}</small>
      <nav className="sidebar-nav" aria-label={t('hub.warzone.departments')}>
        {DEPARTMENTS.map(d => (
          <Link
            key={d.id}
            href={getDepartmentPath(d.id)}
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
