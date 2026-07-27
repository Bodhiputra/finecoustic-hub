'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import HubSidebarBrand from '@/components/HubSidebarBrand';
import SidebarSection from '@/components/warzone/SidebarSection';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, knowledgePagesQuery, unwrapData } from '@/lib/api/routes';
import {
  isKnowledgeBankTool,
  knowledgeBankUrl,
  KNOWLEDGE_PAGES_CHANGED,
} from '@/lib/knowledge';
import {
  dataLinkLabel,
  departmentTasksEnabled,
  deptText,
  getDepartment,
  getDepartmentPath,
} from '@/lib/warzone';
import WarzoneDepartmentNav from '@/components/warzone/WarzoneDepartmentNav';

export default function WarzoneSidebar({
  mode = 'home',
  departmentId = null,
  isToolActive,
  toolParam = '',
  pageParam = '',
}) {
  const { t } = useLocale();
  const router = useRouter();
  const dept = departmentId && departmentId !== 'all' ? getDepartment(departmentId) : null;
  const teamTitle = t('hub.warzone.title');
  const [kbPages, setKbPages] = useState([]);

  const deptBase = departmentId ? getDepartmentPath(departmentId) : '';
  const knowledgeActive = isKnowledgeBankTool(toolParam);
  const dataActive = Boolean(toolParam && dept?.dataLinks?.some(link => link.id === toolParam));
  const tasksActive = !toolParam && departmentTasksEnabled(dept);

  const loadKbPages = useCallback(() => {
    if (!departmentId || departmentId === 'all') return Promise.resolve();
    return fetch(knowledgePagesQuery({ department: departmentId }), { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (!body) return;
        const data = unwrapData(body);
        setKbPages(Array.isArray(data?.pages) ? data.pages : []);
      })
      .catch(() => {});
  }, [departmentId]);

  useEffect(() => {
    loadKbPages();
  }, [loadKbPages, toolParam]);

  useEffect(() => {
    const onChanged = () => loadKbPages();
    window.addEventListener(KNOWLEDGE_PAGES_CHANGED, onChanged);
    return () => window.removeEventListener(KNOWLEDGE_PAGES_CHANGED, onChanged);
  }, [loadKbPages]);

  const rootPages = useMemo(
    () => kbPages
      .filter(page => !page.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
    [kbPages]
  );

  async function createKnowledgePage() {
    if (!departmentId || departmentId === 'all') return;
    const res = await fetch(API_V1.knowledgePages, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        department: departmentId,
        parent_id: null,
        title: t('hub.knowledge.untitled'),
        content: '',
      }),
    });
    if (!res.ok) return;
    const body = await res.json();
    const data = unwrapData(body);
    if (!data?.page) return;
    await loadKbPages();
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_PAGES_CHANGED));
    router.push(knowledgeBankUrl(deptBase, { pageId: data.page.id }));
  }

  if (mode === 'department' && dept) {
    const deptTitle = deptText(dept, t, 'label');

    return (
      <>
        <HubSidebarBrand
          title={deptTitle}
          backHref="/"
          backLabel={t('hub.warzone.home')}
        />

        {departmentTasksEnabled(dept) && (
          <SidebarSection title={t('hub.warzone.sectionTasks')} defaultOpen={tasksActive}>
            <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.warzone.sectionTasks')}>
              <Link
                href={getDepartmentPath(departmentId)}
                className={`nav nav-sub${tasksActive ? ' active' : ''}`}
                aria-current={tasksActive ? 'page' : undefined}
                title={t('hub.warzone.deptTasks')}
              >
                <Icon name="kanban" size={15} />
                <span className="nav-label">{t('hub.warzone.deptTasks')}</span>
              </Link>
            </nav>
          </SidebarSection>
        )}

        {dept.dataLinks?.length > 0 && (
          <SidebarSection title={t('hub.warzone.sectionData')} defaultOpen={dataActive}>
            <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.warzone.sectionData')}>
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
          </SidebarSection>
        )}

        <SidebarSection
          title={t('hub.knowledge.section')}
          defaultOpen={knowledgeActive || rootPages.length > 0}
          actionLabel={t('hub.knowledge.newPage')}
          onAction={createKnowledgePage}
        >
          <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.knowledge.section')}>
            {rootPages.length === 0 && (
              <p className="knowledge-sidebar-empty">{t('hub.knowledge.sidebarEmpty')}</p>
            )}
            {rootPages.map(page => (
              <Link
                key={page.id}
                href={knowledgeBankUrl(deptBase, { pageId: page.id })}
                className={`nav nav-sub knowledge-sidebar-page${pageParam === page.id ? ' active' : ''}`}
                aria-current={pageParam === page.id ? 'page' : undefined}
              >
                <Icon name="book" size={14} />
                <span className="nav-label">{page.title}</span>
              </Link>
            ))}
          </nav>
        </SidebarSection>
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
