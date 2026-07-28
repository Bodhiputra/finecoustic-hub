'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import TaskPanel from '@/components/internal/TaskPanel';
import InternalBoard from '@/components/internal/InternalBoard';
import InternalListView from '@/components/internal/InternalListView';
import InternalTaskFilters from '@/components/internal/InternalTaskFilters';
import InternalSidebar from '@/components/internal/InternalSidebar';
import CampaignsWorkspace from '@/components/internal/CampaignsWorkspace';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useInternalTasks } from '@/hooks/useInternalTasks';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { boardStatusColumns } from '@/lib/internal-campaigns';
import {
  collectPeopleFromTasks,
  dataLinkLabel,
  departmentTasksEnabled,
  deptText,
  getDepartment,
  getDepartmentPath,
  newTaskDraft,
  parsePeopleParam,
  taskMatchesPeopleFilter,
  taskBelongsToDepartment,
  internalTasksUrl,
} from '@/lib/internal';
import { MarketingHubContent } from '@/components/MarketingHub';
import { OpsHubContent } from '@/components/OpsHub';
import KnowledgeBank from '@/components/knowledge/KnowledgeBank';
import {
  isKnowledgeBankTool,
  knowledgeBankUrl,
} from '@/lib/knowledge';

const BUCKET_VIEWS = ['today', 'overdue', 'in_progress', 'bank', 'milestones'];
const TASK_VIEWS = ['list', 'board'];

export default function InternalDepartment({
  departmentId,
  authEnabled,
  initialBucket = '',
  initialTool = '',
  initialTasks = null,
  opsData = null,
  marketingRows = [],
  initialCampaigns = [],
  initialBoard = null,
}) {
  const dept = getDepartment(departmentId);
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view') || initialBucket || '';
  const toolParam = searchParams.get('tool') || initialTool || '';
  const boardParam = searchParams.get('board') || '';
  const pageParam = searchParams.get('page') || '';
  const boardView = Boolean(boardParam && initialBoard);
  const tasksEnabled = departmentId === 'all' || departmentTasksEnabled(dept);

  const bucket = BUCKET_VIEWS.includes(viewParam) ? viewParam : (searchParams.get('bucket') || '');
  const view = BUCKET_VIEWS.includes(viewParam)
    ? 'list'
    : (TASK_VIEWS.includes(viewParam) ? viewParam : 'board');
  const activePeople = useMemo(
    () => parsePeopleParam(searchParams.get('people')),
    [searchParams]
  );

  const { tasks, refresh } = useInternalTasks({
    departmentId,
    bucket,
    boardId: boardParam,
    initialTasks,
  });

  const [panelTask, setPanelTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [me, setMe] = useState({ displayName: '' });

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.displayName) setMe({ displayName: data.displayName, hubUser: data.hubUser });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tasksEnabled || toolParam || boardParam) return;
    if (dept?.dataLinks?.length) {
      router.replace(dept.dataLinks[0].href);
      return;
    }
    router.replace(knowledgeBankUrl(getDepartmentPath(departmentId)));
  }, [tasksEnabled, toolParam, boardParam, dept, router, departmentId]);

  const lockBoard = boardView && initialBoard
    ? { board_id: initialBoard.id, campaign_id: initialBoard.campaign_id || initialBoard.campaign?.id || null }
    : null;

  const filtered = useMemo(() => {
    if (departmentId === 'all') return tasks;
    return tasks.filter(task => taskBelongsToDepartment(task, departmentId));
  }, [tasks, departmentId]);

  const baseTaskItems = useMemo(
    () => filtered.filter(task => task.kind === 'task' && task.status !== 'archived'),
    [filtered]
  );

  const peopleOptions = useMemo(
    () => collectPeopleFromTasks(baseTaskItems),
    [baseTaskItems]
  );

  const taskItems = useMemo(
    () => baseTaskItems.filter(task => taskMatchesPeopleFilter(task, activePeople)),
    [baseTaskItems, activePeople]
  );

  async function handleSave(draft) {
    setSaving(true);
    try {
      const isNew = !draft.id || draft._draft;
      const res = await fetch(isNew ? API_V1.internalTasks : API_V1.internalTask(draft.id), {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...draft, _draft: undefined, subtasks: (draft.subtasks || []).filter(s => s.title?.trim()) }),
      });
      if (res.ok) {
        setPanelTask(null);
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(task, status) {
    const res = await fetch(API_V1.internalTask(task.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    });
    if (res.ok) await refresh();
  }

  async function handleDelete(id) {
    const ok = await requestConfirm({
      title: t('hub.internal.taskPanel.delete'),
      message: t('hub.internal.deleteConfirm'),
      confirmLabel: t('hub.internal.taskPanel.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    await fetch(API_V1.internalTask(id), { method: 'DELETE', credentials: 'same-origin' });
    setPanelTask(null);
    await refresh();
  }

  async function postComment(taskId, payload) {
    setPostingComment(true);
    try {
      const res = await fetch(API_V1.internalTaskComments(taskId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('comment');
      const body = await res.json();
      const data = unwrapData(body, 'task');
      const task = data?.task || data;
      if (task?.id) setPanelTask(task);
      await refresh();
    } finally {
      setPostingComment(false);
    }
  }

  function openNew() {
    setPanelTask(newTaskDraft({
      department: departmentId === 'all' ? 'operations' : departmentId,
      visibility: 'team',
      status: 'todo',
      board_id: lockBoard?.board_id || null,
      campaign_id: lockBoard?.campaign_id || null,
    }));
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (!dept && departmentId !== 'all') {
    return <p>Department not found.</p>;
  }

  const deptBase = getDepartmentPath(departmentId);
  const sidebarMode = departmentId === 'all' ? 'all-tasks' : 'department';

  function viewHref(viewId) {
    return internalTasksUrl(deptBase, { view: viewId, people: activePeople });
  }

  function isTaskViewActive(viewId) {
    if (toolParam) return false;
    if (BUCKET_VIEWS.includes(viewId)) return viewParam === viewId;
    return viewParam === viewId || (!viewParam && viewId === 'board');
  }

  function isToolActive(toolId) {
    if (toolId === 'campaigns' && boardParam) return true;
    return toolParam === toolId;
  }

  const deptTaskSection = tasksEnabled && !toolParam;
  const boardTaskSection = boardView;
  const boardStatusCols = boardView ? boardStatusColumns(initialBoard) : null;

  const taskViews = [
    { id: 'board', label: t('hub.internal.viewBoard'), icon: 'kanban' },
    { id: 'list', label: t('hub.internal.viewList'), icon: 'layout' },
  ];

  const topNavTitle = boardView
    ? initialBoard.name
    : departmentId === 'all'
      ? t('hub.internal.allTasks')
      : (dept ? deptText(dept, t, 'label') : '');
  const activeToolLink = toolParam && dept?.dataLinks?.find(link => link.id === toolParam);
  const topNavSubtitle = boardView
    ? (initialBoard.campaign?.name || t('hub.internal.campaigns'))
    : isKnowledgeBankTool(toolParam)
      ? t('hub.knowledge.title')
      : (activeToolLink ? dataLinkLabel(activeToolLink, t) : '');

  return (
    <HubLayout
      className="internal-dept-layout"
      topNavTitle={topNavTitle}
      topNavSubtitle={topNavSubtitle}
      authEnabled={authEnabled}
      displayName={me.displayName}
      onLogout={handleLogout}
      sidebarClassName="internal-dept-sidebar"
      sidebarLabel={departmentId === 'all' ? t('hub.internal.allTasks') : (dept ? t(dept.labelKey) : '')}
      sidebar={
        <InternalSidebar
          mode={sidebarMode}
          departmentId={departmentId}
          isToolActive={isToolActive}
          toolParam={toolParam}
          pageParam={pageParam}
        />
      }
    >
      <main className="main internal-dept-main">
        {boardView && (
          <div className="internal-board-toolbar">
            <Link href="/marketing?tool=campaigns" className="internal-board-back">
              <Icon name="arrowLeft" size={14} />
              {t('hub.internal.backToCampaigns')}
            </Link>
            {initialBoard.campaign?.name ? (
              <span className="internal-board-context">{initialBoard.campaign.name}</span>
            ) : null}
          </div>
        )}

        {deptTaskSection && (
          <div className="internal-dept-toolbar">
            <div className="internal-dept-view-tabs" role="toolbar" aria-label={t('hub.internal.sectionTasks')}>
              {taskViews.map(({ id, label, icon }) => (
                <Link
                  key={id}
                  href={viewHref(id)}
                  className={`internal-dept-view-tab${isTaskViewActive(id) ? ' is-active' : ''}`}
                  aria-current={isTaskViewActive(id) ? 'page' : undefined}
                >
                  <Icon name={icon} size={15} />
                  {label}
                </Link>
              ))}
            </div>
            {departmentId !== 'all' && (
              <button
                type="button"
                className="appdev-btn-primary internal-add-btn"
                onClick={() => openNew()}
                disabled={saving}
              >
                <Icon name="plus" size={16} />
                {t('hub.internal.addTaskIssue')}
              </button>
            )}
          </div>
        )}

        {deptTaskSection && (
          <InternalTaskFilters
            deptBase={deptBase}
            activeView={BUCKET_VIEWS.includes(viewParam) ? viewParam : ''}
            taskView={view}
            activePeople={activePeople}
            people={peopleOptions}
          />
        )}

        {boardTaskSection && (
          <div className="internal-dept-toolbar internal-dept-toolbar--board">
            <button
              type="button"
              className="appdev-btn-primary internal-add-btn"
              onClick={() => openNew()}
              disabled={saving}
            >
              <Icon name="plus" size={16} />
              {t('hub.internal.addTaskIssue')}
            </button>
          </div>
        )}

        {boardParam && !initialBoard && (
          <p className="internal-empty">{t('hub.internal.boardNotFound')}</p>
        )}

        {toolParam === 'campaigns' && !boardParam && (
          <CampaignsWorkspace departmentId={departmentId} initialCampaigns={initialCampaigns} />
        )}

        {toolParam && departmentId === 'marketing' && toolParam !== 'campaigns' && (
          <MarketingHubContent view={toolParam} initialRows={marketingRows} />
        )}

        {toolParam && departmentId === 'operations' && opsData && !isKnowledgeBankTool(toolParam) && (
          <OpsHubContent initialData={opsData} view={toolParam} />
        )}

        {isKnowledgeBankTool(toolParam) && departmentId !== 'all' && (
          <KnowledgeBank
            departmentId={departmentId}
            deptBase={deptBase}
            pageId={pageParam}
          />
        )}

        {!deptTaskSection && !toolParam && !boardView && dept && (
          <p className="internal-empty personal-hub-hint">{deptText(dept, t, 'description')}</p>
        )}

        {deptTaskSection && view === 'list' && (
          <InternalListView tasks={taskItems} onTaskClick={setPanelTask} />
        )}

        {((deptTaskSection && view === 'board') || boardTaskSection) && (
          <InternalBoard
            tasks={taskItems}
            onTaskClick={setPanelTask}
            onStatusChange={handleStatusChange}
            statusColumns={boardStatusCols}
          />
        )}
      </main>

      {panelTask && (
        <TaskPanel
          task={panelTask}
          onClose={() => setPanelTask(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onPostComment={postComment}
          postingComment={postingComment}
          displayName={me.displayName}
          lockDepartmentId={departmentId !== 'all' ? departmentId : null}
          lockBoard={lockBoard}
          saving={saving}
        />
      )}

      {confirmDialog}
    </HubLayout>
  );
}
