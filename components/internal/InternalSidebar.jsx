'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import HubSidebarBrand from '@/components/HubSidebarBrand';
import SidebarSection from '@/components/internal/SidebarSection';
import { useLocale } from '@/components/LocaleProvider';
import { usePrompt } from '@/hooks/usePrompt';
import { useToast } from '@/hooks/useToast';
import { API_V1, internalBoardsQuery, unwrapData } from '@/lib/api/routes';
import { departmentBoardUrl, personalBoardUrl } from '@/lib/campaign-urls';
import { filterSidebarBoards } from '@/lib/sidebar-boards';
import { personalJotDownUrl, PERSONAL_JOT_DOWN_TOOL } from '@/lib/personal-jots-shared';
import { departmentJotDownUrl, isJotDownTool } from '@/lib/knowledge';
import { dispatchBoardsChanged, INTERNAL_BOARDS_CHANGED } from '@/lib/internal-boards';
import {
  PERSONAL_DEPARTMENT_ID,
  dataLinkLabel,
  departmentKanbansEnabled,
  deptText,
  getDepartment,
  getDepartmentPath,
} from '@/lib/internal';
import InternalDepartmentNav from '@/components/internal/InternalDepartmentNav';
import { useHubSessionProfile } from '@/hooks/useHubSession';

export default function InternalSidebar({
  mode = 'home',
  departmentId = null,
  isToolActive,
  toolParam = '',
  pageParam = '',
  boardParam = '',
  flowParam = '',
  initialWikiPages = null,
  initialHubUser = null,
  initialDeptBoards = null,
  initialPersonalBoards = null,
  personalAssignedCount = 0,
  homeTab = null,
  wikiPageId = '',
  onHomeTabChange = null,
  clientDeptTools = false,
  onDeptToolChange = null,
  clientDeptBoardNav = false,
  onDeptBoardChange = null,
}) {
  const { t } = useLocale();
  const sessionProfile = useHubSessionProfile();
  const seededHubUser = initialHubUser ?? sessionProfile?.hubUser ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const { requestPrompt, promptDialog } = usePrompt();
  const { toast, toastStack } = useToast();
  const [canManageUsers, setCanManageUsers] = useState(() => Boolean(seededHubUser?.permissions?.canManageUsers));
  const dept = departmentId && departmentId !== 'all' ? getDepartment(departmentId) : null;
  const teamTitle = t('hub.internal.title');
  const [deptBoards, setDeptBoards] = useState(() => filterSidebarBoards(initialDeptBoards || []));
  const [personalBoards, setPersonalBoards] = useState(() => filterSidebarBoards(initialPersonalBoards || []));
  const [boardsLoaded, setBoardsLoaded] = useState(() => initialDeptBoards != null);
  const [personalBoardsLoaded, setPersonalBoardsLoaded] = useState(() => initialPersonalBoards != null);
  const kanbansEnabled = departmentKanbansEnabled(departmentId);
  const personalKanbans = mode === 'personal' || departmentId === PERSONAL_DEPARTMENT_ID;

  const deptBase = departmentId ? getDepartmentPath(departmentId) : '';
  const jotDownActive = isJotDownTool(toolParam);
  const dataActive = Boolean(toolParam && dept?.dataLinks?.some(link => link.id === toolParam));

  const loadDeptBoards = useCallback(() => {
    if (!kanbansEnabled) return Promise.resolve();
    return fetch(internalBoardsQuery({ department: departmentId }), { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (!body) return;
        const data = unwrapData(body);
        setDeptBoards(filterSidebarBoards(Array.isArray(data?.boards) ? data.boards : []));
        setBoardsLoaded(true);
      })
      .catch(() => {});
  }, [departmentId, kanbansEnabled]);

  const loadPersonalBoards = useCallback(() => {
    if (!personalKanbans) return Promise.resolve();
    return fetch(internalBoardsQuery({ scope: 'personal' }), { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (!body) return;
        const data = unwrapData(body);
        setPersonalBoards(filterSidebarBoards(Array.isArray(data?.boards) ? data.boards : []));
        setPersonalBoardsLoaded(true);
      })
      .catch(() => {});
  }, [personalKanbans]);

  useEffect(() => {
    if (initialDeptBoards == null) return;
    setDeptBoards(filterSidebarBoards(initialDeptBoards));
    setBoardsLoaded(true);
  }, [initialDeptBoards]);

  useEffect(() => {
    if (initialPersonalBoards == null) return;
    setPersonalBoards(filterSidebarBoards(initialPersonalBoards));
    setPersonalBoardsLoaded(true);
  }, [initialPersonalBoards]);

  useEffect(() => {
    if (seededHubUser?.permissions) {
      setCanManageUsers(Boolean(seededHubUser.permissions.canManageUsers));
      return;
    }
    fetch('/api/auth/me?scope=hub', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        setCanManageUsers(Boolean(data?.hubUser?.permissions?.canManageUsers));
      })
      .catch(() => {});
  }, [seededHubUser?.permissions?.canManageUsers, seededHubUser?.id]);

  useEffect(() => {
    if (!kanbansEnabled || boardsLoaded) return;
    loadDeptBoards();
  }, [kanbansEnabled, boardsLoaded, loadDeptBoards]);

  useEffect(() => {
    if (!personalKanbans || personalBoardsLoaded) return;
    loadPersonalBoards();
  }, [personalKanbans, personalBoardsLoaded, loadPersonalBoards]);

  useEffect(() => {
    const onBoardsChanged = () => {
      loadDeptBoards();
      loadPersonalBoards();
    };
    window.addEventListener(INTERNAL_BOARDS_CHANGED, onBoardsChanged);
    return () => window.removeEventListener(INTERNAL_BOARDS_CHANGED, onBoardsChanged);
  }, [loadDeptBoards, loadPersonalBoards]);

  async function createDeptKanban() {
    if (!kanbansEnabled) return;
    const name = await requestPrompt({
      title: t('hub.internal.addDeptKanban'),
      label: t('hub.internal.boardNamePrompt'),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    });
    if (!name) return;

    const res = await fetch(API_V1.internalBoards, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, department: departmentId }),
    });
    if (!res.ok) {
      toast.error(t('common.somethingWrong'));
      return;
    }

    const body = await res.json();
    const data = unwrapData(body);
    const board = data?.board;
    if (!board?.id) {
      toast.error(t('common.somethingWrong'));
      return;
    }

    dispatchBoardsChanged();
    toast.success(t('hub.internal.boardCreated'));
    router.push(departmentBoardUrl(deptBase, board.id));
  }

  async function createPersonalKanban() {
    const name = await requestPrompt({
      title: t('hub.personal.addKanban'),
      label: t('hub.internal.boardNamePrompt'),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    });
    if (!name) return;

    const res = await fetch(API_V1.internalBoards, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, scope: 'personal' }),
    });
    if (!res.ok) {
      toast.error(t('common.somethingWrong'));
      return;
    }

    const body = await res.json();
    const data = unwrapData(body);
    const board = data?.board;
    if (!board?.id) {
      toast.error(t('common.somethingWrong'));
      return;
    }

    dispatchBoardsChanged();
    toast.success(t('hub.internal.boardCreated'));
    router.push(personalBoardUrl(board.id));
  }

  if (mode === 'personal') {
    return (
      <>
        <HubSidebarBrand
          title={t('hub.personal.title')}
          homeHref="/"
          homeLabel={t('hub.internal.home')}
        />
        <nav className="sidebar-nav sidebar-nav-personal-top" aria-label={t('hub.personal.navPersonalLinks')}>
          <Link
            href="/me"
            className={`nav${!boardParam && toolParam !== PERSONAL_JOT_DOWN_TOOL ? ' active' : ''}`}
            aria-current={!boardParam && toolParam !== PERSONAL_JOT_DOWN_TOOL ? 'page' : undefined}
          >
            <Icon name="user" size={15} />
            <span className="nav-label">{t('hub.personal.assignedTitle')}</span>
            <span
              className="nav-hint-chip"
              aria-label={t('hub.personal.assignedCountHint').replace('{count}', String(personalAssignedCount))}
            >
              {personalAssignedCount}
            </span>
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
        <SidebarSection
          title={t('hub.personal.sectionKanbans')}
          defaultOpen
          actionLabel={t('hub.personal.addKanban')}
          onAction={createPersonalKanban}
        >
          <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.personal.sectionKanbans')}>
            {personalBoards.length === 0 && (
              <p className="knowledge-sidebar-empty">{t('hub.personal.kanbansEmpty')}</p>
            )}
            {personalBoards.map(board => (
              clientDeptBoardNav && typeof onDeptBoardChange === 'function' ? (
                <button
                  key={board.id}
                  type="button"
                  className={`nav nav-sub${boardParam === board.id ? ' active' : ''}`}
                  aria-current={boardParam === board.id ? 'page' : undefined}
                  title={board.name}
                  onClick={() => onDeptBoardChange(board.id)}
                >
                  <Icon name="kanban" size={15} />
                  <span className="nav-label">{board.name}</span>
                </button>
              ) : (
                <Link
                  key={board.id}
                  href={personalBoardUrl(board.id)}
                  className={`nav nav-sub${boardParam === board.id ? ' active' : ''}`}
                  aria-current={boardParam === board.id ? 'page' : undefined}
                  title={board.name}
                >
                  <Icon name="kanban" size={15} />
                  <span className="nav-label">{board.name}</span>
                </Link>
              )
            ))}
          </nav>
        </SidebarSection>
        <nav className="sidebar-nav sidebar-nav-personal-top" aria-label={t('hub.jotDown.navLabel')}>
          <Link
            href={personalJotDownUrl()}
            className={`nav${toolParam === PERSONAL_JOT_DOWN_TOOL ? ' active' : ''}`}
            aria-current={toolParam === PERSONAL_JOT_DOWN_TOOL ? 'page' : undefined}
          >
            <Icon name="edit" size={15} />
            <span className="nav-label">{t('hub.jotDown.title')}</span>
          </Link>
        </nav>
        {promptDialog}
        {toastStack}
      </>
    );
  }

  if (mode === 'department' && dept) {
    const deptTitle = deptText(dept, t, 'label');

    return (
      <>
        <HubSidebarBrand
          title={deptTitle}
          homeLabel={t('hub.internal.home')}
        />

        {kanbansEnabled && (
          <SidebarSection
            title={t('hub.internal.sectionKanbans')}
            defaultOpen
            actionLabel={t('hub.internal.addDeptKanban')}
            onAction={createDeptKanban}
          >
            <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.internal.sectionKanbans')}>
              {deptBoards.length === 0 && (
                <p className="knowledge-sidebar-empty">{t('hub.internal.deptKanbansEmpty')}</p>
              )}
              {deptBoards.map(board => (
                clientDeptBoardNav && typeof onDeptBoardChange === 'function' ? (
                  <button
                    key={board.id}
                    type="button"
                    className={`nav nav-sub${boardParam === board.id ? ' active' : ''}`}
                    aria-current={boardParam === board.id ? 'page' : undefined}
                    title={board.name}
                    onClick={() => onDeptBoardChange(board.id)}
                  >
                    <Icon name="kanban" size={15} />
                    <span className="nav-label">{board.name}</span>
                  </button>
                ) : (
                  <Link
                    key={board.id}
                    href={departmentBoardUrl(deptBase, board.id)}
                    className={`nav nav-sub${boardParam === board.id ? ' active' : ''}`}
                    aria-current={boardParam === board.id ? 'page' : undefined}
                    title={board.name}
                  >
                    <Icon name="kanban" size={15} />
                    <span className="nav-label">{board.name}</span>
                  </Link>
                )
              ))}
            </nav>
          </SidebarSection>
        )}

        {dept.dataLinks?.length > 0 && (
          <SidebarSection title={t('hub.internal.sectionData')} defaultOpen={dataActive}>
            <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.internal.sectionData')}>
              {dept.dataLinks.map(link => (
                clientDeptTools && typeof onDeptToolChange === 'function' ? (
                  <button
                    key={link.id || link.href}
                    type="button"
                    className={`nav nav-sub${isToolActive(link.id) ? ' active' : ''}`}
                    aria-current={isToolActive(link.id) ? 'page' : undefined}
                    title={dataLinkLabel(link, t)}
                    onClick={() => onDeptToolChange(link.id)}
                  >
                    <Icon name="layout" size={15} />
                    <span className="nav-label">{dataLinkLabel(link, t)}</span>
                  </button>
                ) : (
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
                )
              ))}
            </nav>
          </SidebarSection>
        )}

        <nav className="sidebar-nav sidebar-nav-personal-top" aria-label={t('hub.jotDown.navLabel')}>
          <Link
            href={departmentJotDownUrl(deptBase)}
            className={`nav${jotDownActive && !boardParam ? ' active' : ''}`}
            aria-current={jotDownActive && !boardParam ? 'page' : undefined}
          >
            <Icon name="edit" size={15} />
            <span className="nav-label">{t('hub.jotDown.title')}</span>
          </Link>
        </nav>

        {promptDialog}
        {toastStack}
      </>
    );
  }

  if (mode === 'campaigns') {
    return (
      <>
        <HubSidebarBrand
          title={t('hub.internal.campaignList')}
          homeLabel={t('hub.internal.home')}
        />
      </>
    );
  }

  if (mode === 'all-tasks') {
    return (
      <>
        <HubSidebarBrand
          title={t('hub.internal.allTasks')}
          homeLabel={t('hub.internal.home')}
        />
      </>
    );
  }

  return (
    <>
      <HubSidebarBrand title={teamTitle} homeLabel={t('hub.internal.home')} />
      <div className="internal-sidebar-home-shell">
        <InternalDepartmentNav
          initialWikiPages={initialWikiPages}
          initialHubUser={seededHubUser}
          homeTab={homeTab}
          wikiPageId={wikiPageId}
          onHomeTabChange={onHomeTabChange}
        />
      </div>
    </>
  );
}
