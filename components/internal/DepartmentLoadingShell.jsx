'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import HubSidebarBrand from '@/components/HubSidebarBrand';
import SidebarSection from '@/components/internal/SidebarSection';
import { useLocale } from '@/components/LocaleProvider';
import RouteLoading from '@/components/RouteLoading';
import { HubLayout } from '@/components/HubSidebarContext';
import { departmentBoardUrl } from '@/lib/campaign-urls';
import { marketingToolFromPathname } from '@/lib/marketing-routes';
import { departmentJotDownUrl } from '@/lib/knowledge';
import {
  dataLinkLabel,
  departmentKanbansEnabled,
  deptText,
  getDepartment,
  getDepartmentPath,
} from '@/lib/internal';

const LOADING_LABELS = {
  operations: 'Loading operations…',
  marketing: 'Loading marketing…',
  products: 'Loading products…',
  creatives: 'Loading creatives…',
  all: 'Loading tasks…',
};

/** Instant sidebar chrome while route data loads — DATA links are static config. */
export default function DepartmentLoadingShell({ departmentId = 'marketing' }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const dept = getDepartment(departmentId);
  const deptBase = getDepartmentPath(departmentId);
  const pathTool = marketingToolFromPathname(pathname);
  const kanbansEnabled = departmentKanbansEnabled(departmentId);

  if (!dept) {
    return <RouteLoading variant="hub" label={LOADING_LABELS[departmentId] || 'Loading…'} />;
  }

  return (
    <HubLayout
      className="internal-dept-layout"
      topNavTitle={deptText(dept, t, 'label')}
      sidebarClassName="internal-dept-sidebar"
      sidebarLabel={deptText(dept, t, 'label')}
      sidebar={(
        <>
          <HubSidebarBrand
            title={deptText(dept, t, 'label')}
            homeLabel={t('hub.internal.home')}
          />
          {kanbansEnabled ? (
            <SidebarSection title={t('hub.internal.sectionKanbans')} defaultOpen>
              <p className="knowledge-sidebar-empty route-loading-inline">{t('hub.internal.deptKanbansEmpty')}</p>
            </SidebarSection>
          ) : null}
          {dept.dataLinks?.length > 0 ? (
            <SidebarSection title={t('hub.internal.sectionData')} defaultOpen>
              <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.internal.sectionData')}>
                {dept.dataLinks.map(link => (
                  <Link
                    key={link.id || link.href}
                    href={link.href}
                    className={`nav nav-sub${pathTool === link.id ? ' active' : ''}`}
                    aria-current={pathTool === link.id ? 'page' : undefined}
                  >
                    <Icon name="layout" size={15} />
                    <span className="nav-label">{dataLinkLabel(link, t)}</span>
                  </Link>
                ))}
              </nav>
            </SidebarSection>
          ) : null}
          <nav className="sidebar-nav sidebar-nav-personal-top" aria-label={t('hub.jotDown.navLabel')}>
            <Link href={departmentJotDownUrl(deptBase)} className="nav">
              <Icon name="edit" size={15} />
              <span className="nav-label">{t('hub.jotDown.title')}</span>
            </Link>
          </nav>
        </>
      )}
    >
      <main className="main internal-dept-main">
        <RouteLoading variant="hub" label={LOADING_LABELS[departmentId] || 'Loading department…'} />
      </main>
    </HubLayout>
  );
}
