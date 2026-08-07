'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import TaskPanel from '@/components/internal/TaskPanel';
import InternalBoard from '@/components/internal/InternalBoard';
import InternalListView from '@/components/internal/InternalListView';
import InternalTaskFilters from '@/components/internal/InternalTaskFilters';
import InternalSidebar from '@/components/internal/InternalSidebar';
import CampaignsWorkspace from '@/components/internal/CampaignsWorkspace';
import CampaignFlowCanvas from '@/components/internal/CampaignFlowCanvas';
import BoardStatusEditor from '@/components/internal/BoardStatusEditor';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useInternalTasks } from '@/hooks/useInternalTasks';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { campaignBoardUrl, campaignFlowUrl, campaignListUrl } from '@/lib/campaign-urls';
import { boardStatusColumns, flowStatusColumns, statusColumnLabel } from '@/lib/internal-campaigns';
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
import ProductsWorkspace from '@/components/products/ProductsWorkspace';
import KnowledgeBank from '@/components/knowledge/KnowledgeBank';
import {
  isKnowledgeBankTool,
  knowledgeBankUrl,
} from '@/lib/knowledge';

const BUCKET_VIEWS = ['today', 'overdue', 'in_progress', 'bank', 'milestones'];
const TASK_VIEWS = ['list', 'board'];
const FLOW_CVIEW = ['flow', 'board', 'list'];

export default function InternalDepartment({
  departmentId,
  authEnabled,
  initialBucket = '',
  initialTool = '',
  initialTasks = null,
  initialTasksFilterKey = null,
  opsData = null,
  marketingRows = [],
  initialCampaigns = [],
  initialBoard = null,
  initialCampaign = null,
  initialProducts = null,
  initialProductDetail = null,
  initialMe = null,
}) {
  const dept = getDepartment(departmentId);
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const { toast, toastStack } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view') || initialBucket || '';
  const toolParam = searchParams.get('tool') || initialTool || '';
  const boardParam = searchParams.get('board') || '';
  const flowParam = searchParams.get('flow') || '';
  const cviewParam = searchParams.get('cview') || '';
  const pageParam = searchParams.get('page') || '';
  const productParam = searchParams.get('product') || '';
  const tabParam = searchParams.get('tab') || 'overview';
  const productsMode = departmentId === 'products';
  const tasksEnabled = departmentId === 'all' || departmentTasksEnabled(dept);
  const marketingCampaignMode = departmentId === 'marketing';
  const campaignListOnly = marketingCampaignMode && toolParam === 'campaigns' && !boardParam && !flowParam;
  const shouldLoadTasks = Boolean(boardParam || flowParam || (tasksEnabled && !campaignListOnly));

  const view = BUCKET_VIEWS.includes(viewParam)
    ? 'list'
    : (TASK_VIEWS.includes(viewParam) ? viewParam : 'board');
  const activePeople = useMemo(
    () => parsePeopleParam(searchParams.get('people')),
    [searchParams]
  );

  const { tasks, refresh } = useInternalTasks({
    departmentId,
    viewParam,
    boardId: boardParam,
    campaignId: flowParam,
    flowOnly: Boolean(flowParam),
    initialTasks: shouldLoadTasks ? initialTasks : null,
    initialTasksFilterKey: shouldLoadTasks ? initialTasksFilterKey : null,
    enabled: shouldLoadTasks,
  });

  const [panelTask, setPanelTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [me, setMe] = useState(() => initialMe ?? { displayName: '' });
  const [activeBoard, setActiveBoard] = useState(initialBoard);
  const [activeCampaign, setActiveCampaign] = useState(initialCampaign);
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);

  useEffect(() => {
    setActiveBoard(initialBoard);
    setStatusEditorOpen(false);
  }, [initialBoard]);

  useEffect(() => {
    setActiveCampaign(initialCampaign);
  }, [initialCampaign]);

  const boardView = Boolean(boardParam && activeBoard);
  const flowView = Boolean(flowParam && activeCampaign?.flow_enabled);
  const flowCview = FLOW_CVIEW.includes(cviewParam) ? cviewParam : 'flow';
  const boardCview = cviewParam === 'list' ? 'list' : 'board';

  useEffect(() => {
    if (initialMe?.displayName) return;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.displayName) setMe({ displayName: data.displayName, hubUser: data.hubUser });
      })
      .catch(() => {});
  }, [initialMe]);

  useEffect(() => {
    fetch(API_V1.hubTeamMembers, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const data = unwrapData(body, 'members');
        const members = Array.isArray(data?.members) ? data.members : Array.isArray(data) ? data : [];
        if (members.length) setTeamMembers(members);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (departmentId === 'products') return;
    if (departmentId === 'marketing' && !toolParam && !boardParam && !flowParam && !initialTool) {
      router.replace('/marketing?tool=campaigns');
      return;
    }
    if (tasksEnabled || toolParam || boardParam || flowParam) return;
    if (dept?.dataLinks?.length) {
      router.replace(dept.dataLinks[0].href);
      return;
    }
    router.replace(knowledgeBankUrl(getDepartmentPath(departmentId)));
  }, [tasksEnabled, toolParam, boardParam, flowParam, dept, router, departmentId, initialTool]);

  const lockBoard = boardView && activeBoard
    ? { board_id: activeBoard.id, campaign_id: activeBoard.campaign_id || activeBoard.campaign?.id || null }
    : null;

  const lockFlow = flowView && activeCampaign
    ? { board_id: null, campaign_id: activeCampaign.id }
    : null;

  const boardStatusCols = useMemo(
    () => (boardView && activeBoard ? boardStatusColumns(activeBoard) : null),
    [boardView, activeBoard]
  );

  const flowStatusCols = useMemo(
    () => (flowView ? flowStatusColumns() : null),
    [flowView]
  );

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

  const flowItems = useMemo(
    () => filtered.filter(
      item => (item.kind === 'task' || item.kind === 'milestone')
        && item.status !== 'archived'
        && taskMatchesPeopleFilter(item, activePeople)
    ),
    [filtered, activePeople]
  );

  const workspaceItems = flowView ? flowItems : taskItems;

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
        if (flowView && activeCampaign && isNew) {
          const body = await res.json();
          const data = unwrapData(body, 'task');
          const saved = data?.task || data;
          if (saved?.id) await appendFlowNode(saved);
        }
        setPanelTask(null);
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function appendFlowNode(item) {
    if (!activeCampaign?.id || !item?.id) return;
    const flowData = activeCampaign.flow_data || { nodes: [], edges: [] };
    if (flowData.nodes?.some(node => node.taskId === item.id)) return;
    const y = (flowData.nodes?.length || 0) * 96;
    await handleSaveFlowData({
      nodes: [
        ...(flowData.nodes || []),
        {
          id: `node-${item.id}`,
          taskId: item.id,
          label: item.title || 'Untitled',
          position: { x: 160, y },
        },
      ],
      edges: flowData.edges || [],
    });
  }

  async function handleStatusChange(task, status) {
    const res = await fetch(API_V1.internalTask(task.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error(t('hub.internal.workflow.transitionFailed'));
      return;
    }
    const body = await res.json();
    const data = unwrapData(body, 'task');
    const updated = data?.task || data;
    await refresh();
    if (panelTask?.id === task.id && updated?.id) setPanelTask(updated);
  }

  async function handleWorkflowAction(taskId, action) {
    setWorkflowBusy(true);
    try {
      const res = await fetch(API_V1.internalTask(taskId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ workflow_action: action }),
      });
      if (!res.ok) {
        toast.error(t('hub.internal.workflow.transitionFailed'));
        return;
      }
      const body = await res.json();
      const data = unwrapData(body, 'task');
      const updated = data?.task || data;
      if (updated?.id) setPanelTask(updated);
      await refresh();
    } finally {
      setWorkflowBusy(false);
    }
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

  function openNew(kind = 'task') {
    const defaultStatus = boardStatusCols?.[0]?.id || flowStatusCols?.[0]?.id || 'todo';
    const lock = lockBoard || lockFlow;
    setPanelTask(newTaskDraft({
      department: departmentId === 'all' ? 'operations' : departmentId,
      visibility: 'team',
      status: defaultStatus,
      kind,
      board_id: lock?.board_id || null,
      campaign_id: lock?.campaign_id || null,
    }));
  }

  async function handleSaveFlowData(flowData) {
    if (!activeCampaign?.id) return;
    try {
      const res = await fetch(API_V1.internalCampaign(activeCampaign.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ flow_data: flowData }),
      });
      if (res.ok) {
        const body = await res.json();
        const data = unwrapData(body);
        if (data?.campaign) {
          setActiveCampaign(prev => ({
            ...prev,
            ...data.campaign,
            flow_data: flowData,
          }));
        }
        return;
      }
      toast.error(t('common.somethingWrong'));
    } catch {
      toast.error(t('common.somethingWrong'));
    }
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
    if (toolId === 'campaigns' && (boardParam || flowParam)) return true;
    return toolParam === toolId;
  }

  const deptTaskSection = tasksEnabled && !toolParam && !marketingCampaignMode;
  const boardTaskSection = boardView;
  const flowTaskSection = flowView;

  const flowViews = [
    { id: 'flow', label: t('hub.internal.viewFlow'), icon: 'flow' },
    { id: 'board', label: t('hub.internal.viewBoard'), icon: 'kanban' },
    { id: 'list', label: t('hub.internal.viewList'), icon: 'layout' },
  ];

  const taskViews = [
    { id: 'board', label: t('hub.internal.viewBoard'), icon: 'kanban' },
    { id: 'list', label: t('hub.internal.viewList'), icon: 'layout' },
  ];

  const flowStatusLabel = useCallback(
    statusId => {
      const col = flowStatusCols?.find(c => c.id === statusId);
      return col ? statusColumnLabel(col, t) : statusId;
    },
    [flowStatusCols, t]
  );

  const topNavTitle = boardView
    ? activeBoard.name
    : flowView
      ? `${activeCampaign.name} · ${t('hub.internal.viewFlow')}`
    : toolParam === 'campaigns' && marketingCampaignMode
      ? t('hub.internal.campaignList')
      : departmentId === 'all'
      ? t('hub.internal.allTasks')
      : (dept ? deptText(dept, t, 'label') : '');
  const activeToolLink = toolParam && dept?.dataLinks?.find(link => link.id === toolParam);
  const topNavSubtitle = boardView
    ? (activeBoard.campaign?.name || t('hub.internal.campaignList'))
    : flowView
      ? t('hub.internal.campaignList')
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
            <Link href={campaignListUrl()} className="internal-board-back">
              <Icon name="arrowLeft" size={14} />
              {t('hub.internal.backToCampaigns')}
            </Link>
            {activeBoard.campaign?.name ? (
              <span className="internal-board-context">{activeBoard.campaign.name}</span>
            ) : null}
          </div>
        )}

        {flowView && (
          <div className="internal-board-toolbar">
            <Link href={campaignListUrl()} className="internal-board-back">
              <Icon name="arrowLeft" size={14} />
              {t('hub.internal.backToCampaigns')}
            </Link>
            <span className="internal-board-context">
              {t('hub.internal.campaignFlowChip').replace('{name}', activeCampaign.name)}
            </span>
          </div>
        )}

        {flowTaskSection && (
          <div className="internal-dept-toolbar internal-dept-toolbar--board">
            <div className="internal-dept-view-tabs" role="toolbar" aria-label={t('hub.internal.flow')}>
              {flowViews.map(({ id, label, icon }) => (
                <Link
                  key={id}
                  href={campaignFlowUrl(activeCampaign.id, id)}
                  className={`internal-dept-view-tab${flowCview === id ? ' is-active' : ''}`}
                  aria-current={flowCview === id ? 'page' : undefined}
                >
                  <Icon name={icon} size={15} />
                  {label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              className="appdev-btn-ghost"
              onClick={() => openNew('milestone')}
              disabled={saving}
            >
              <Icon name="calendar" size={16} />
              {t('hub.internal.addMilestone')}
            </button>
            <button
              type="button"
              className="appdev-btn-primary internal-add-btn"
              onClick={() => openNew('task')}
              disabled={saving}
            >
              <Icon name="plus" size={16} />
              {t('hub.internal.addTaskIssue')}
            </button>
          </div>
        )}

        {boardTaskSection && (
          <div className="internal-dept-toolbar internal-dept-toolbar--board">
            <div className="internal-dept-view-tabs" role="toolbar" aria-label={t('hub.internal.viewBoard')}>
              {taskViews.map(({ id, label, icon }) => (
                <Link
                  key={id}
                  href={campaignBoardUrl(activeBoard.id, id)}
                  className={`internal-dept-view-tab${boardCview === id ? ' is-active' : ''}`}
                  aria-current={boardCview === id ? 'page' : undefined}
                >
                  <Icon name={icon} size={15} />
                  {label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              className="appdev-btn-ghost"
              onClick={() => setStatusEditorOpen(open => !open)}
            >
              {t('hub.internal.editStatusColumns')}
            </button>
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

        {statusEditorOpen && activeBoard && (
          <BoardStatusEditor
            board={activeBoard}
            tasks={taskItems}
            onSaved={setActiveBoard}
            onClose={() => setStatusEditorOpen(false)}
          />
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

        {boardParam && !activeBoard && (
          <p className="internal-empty">{t('hub.internal.boardNotFound')}</p>
        )}

        {flowParam && !flowView && (
          <p className="internal-empty">{t('hub.internal.flowNotFound')}</p>
        )}

        {toolParam === 'campaigns' && !boardParam && !flowParam && (
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

        {productsMode && (
          <ProductsWorkspace
            initialProducts={initialProducts}
            initialDetail={initialProductDetail}
            productSku={productParam}
            activeTab={tabParam}
            displayName={me.displayName}
            isManager={Boolean(me.hubUser?.isManager)}
          />
        )}

        {!deptTaskSection && !toolParam && !boardView && dept && !marketingCampaignMode && !productsMode && (
          <p className="internal-empty personal-hub-hint">{deptText(dept, t, 'description')}</p>
        )}

        {deptTaskSection && view === 'list' && (
          <InternalListView tasks={taskItems} onTaskClick={setPanelTask} />
        )}

        {deptTaskSection && view === 'board' && (
          <InternalBoard
            tasks={taskItems}
            onTaskClick={setPanelTask}
            onStatusChange={handleStatusChange}
          />
        )}

        {boardTaskSection && !statusEditorOpen && boardCview === 'board' && (
          <InternalBoard
            tasks={taskItems}
            onTaskClick={setPanelTask}
            onStatusChange={handleStatusChange}
            statusColumns={boardStatusCols}
            board={activeBoard}
          />
        )}

        {boardTaskSection && boardCview === 'list' && (
          <InternalListView tasks={taskItems} onTaskClick={setPanelTask} />
        )}

        {flowTaskSection && flowCview === 'flow' && (
          <CampaignFlowCanvas
            campaign={activeCampaign}
            tasks={workspaceItems}
            onTaskClick={setPanelTask}
            onSaveFlowData={handleSaveFlowData}
            statusLabelFor={flowStatusLabel}
          />
        )}

        {flowTaskSection && flowCview === 'board' && (
          <InternalBoard
            tasks={workspaceItems}
            onTaskClick={setPanelTask}
            onStatusChange={handleStatusChange}
            statusColumns={flowStatusCols}
            flowData={activeCampaign?.flow_data}
          />
        )}

        {flowTaskSection && flowCview === 'list' && (
          <InternalListView
            tasks={workspaceItems}
            onTaskClick={setPanelTask}
            flowData={activeCampaign?.flow_data}
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
          onWorkflowAction={handleWorkflowAction}
          postingComment={postingComment}
          workflowBusy={workflowBusy}
          displayName={me.displayName}
          lockDepartmentId={departmentId !== 'all' ? departmentId : null}
          lockBoard={lockBoard || lockFlow}
          statusColumns={boardStatusCols || flowStatusCols}
          teamMembers={teamMembers}
          saving={saving}
        />
      )}

      {confirmDialog}
      {toastStack}
    </HubLayout>
  );
}
