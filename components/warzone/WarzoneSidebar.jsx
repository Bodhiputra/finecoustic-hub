'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import HubSidebarBrand from '@/components/HubSidebarBrand';
import { useLocale } from '@/components/LocaleProvider';
import WarzoneDepartmentNav from '@/components/warzone/WarzoneDepartmentNav';
import { dataLinkLabel, deptText, getDepartment, getDepartmentPath } from '@/lib/warzone';

export default function WarzoneSidebar({
  mode = 'home',
  departmentId = null,
  isToolActive,
  toolParam = '',
}) {
  const { t } = useLocale();
  const dept = departmentId && departmentId !== 'all' ? getDepartment(departmentId) : null;
  const teamTitle = t('hub.warzone.title');

  if (mode === 'department' && dept) {
    const deptTitle = deptText(dept, t, 'label');

    return (
      <>
        <HubSidebarBrand
          title={deptTitle}
          backHref="/"
          backLabel={t('hub.warzone.home')}
        />

        <div className="warzone-sidebar-section warzone-sidebar-tasks">
          <small>{t('hub.warzone.sectionTasks')}</small>
          <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.warzone.sectionTasks')}>
            <Link
              href={getDepartmentPath(departmentId)}
              className={`nav nav-sub${!toolParam ? ' active' : ''}`}
              aria-current={!toolParam ? 'page' : undefined}
              title={t('hub.warzone.deptTasks')}
            >
              <Icon name="kanban" size={15} />
              <span className="nav-label">{t('hub.warzone.deptTasks')}</span>
            </Link>
          </nav>
        </div>

        {dept.dataLinks?.length > 0 && (
          <div className="warzone-sidebar-section warzone-sidebar-data">
            <small>{t('hub.warzone.sectionData')}</small>
            <nav className="sidebar-nav sidebar-nav-sub">
              {dept.dataLinks.map(link => (
                <Link
                  key={link.id || link.href}
                  href={link.href}
                  className={`nav nav-sub${isToolActive(link.id) ? ' active' : ''}`}
                  aria-current={isToolActive(link.id) ? 'page' : undefined}
                  title={dataLinkLabel(link, t)}
                >
                  <Icon name="layout" size={15} />
                  <span className="nav-label">{dataLinkLabel(link, t)}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

      </>
    );
  }

  if (mode === 'all-tasks') {
    return (
      <>
        <HubSidebarBrand
          title={t('hub.warzone.allTasks')}
          backHref="/"
          backLabel={t('hub.warzone.home')}
        />
      </>
    );
  }

  return (
    <>
      <HubSidebarBrand title={teamTitle} />

      <WarzoneDepartmentNav />
    </>
  );
}
