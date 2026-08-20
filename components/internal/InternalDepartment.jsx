'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import InternalListView from '@/components/internal/InternalListView';
import InternalTaskFilters from '@/components/internal/InternalTaskFilters';
import InternalSidebar from '@/components/internal/InternalSidebar';
import BoardStatusEditor from '@/components/internal/BoardStatusEditor';
import KanbanCreateModal from '@/components/internal/KanbanCreateModal';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useInternalTasks } from '@/hooks/useInternalTasks';
import { useTaskDeepLink } from '@/hooks/useTaskDeepLink';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { boardUrlForContext, campaignBoardUrl, campaignFlowUrl, campaignListHomeUrl, campaignListUrl, departmentBoardUrl, marketingKolOutreachUrl, personalBoardUrl } from '@/lib/campaign-urls';
import { navigateToBoardOrigin } from '@/lib/client-board-nav';
import { initiativeFromCampaign } from '@/lib/kol-outreach-shared';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/kol-outreach-shared';
import { marketingToolFromPathname, marketingToolPath } from '@/lib/marketing-routes';
import { MarketingHubContent } from '@/components/MarketingHub';
import { OpsHubContent } from '@/components/OpsHub';
import OpsStockPanel from '@/components/ops/OpsStockPanel';
import OpsExpensesPanel from '@/components/ops/OpsExpensesPanel';
import { PERSONAL_JOT_DOWN_TOOL } from '@/lib/personal-jots-shared';
import { dispatchBoardsChanged } from '@/lib/internal-boards';
import { appendKanbanNodeToFlow } from '@/lib/campaign-flow-utils';
import { boardStatusColumns, flowStatusColumns, statusColumnLabel } from '@/lib/internal-campaigns';
import { useFlowKanbanPickerBoards } from '@/hooks/useFlowKanbanPickerBoards';
import {
  collectPeopleFromTasks,
  collectSubtypesFromTasks,
  dataLinkLabel,
  departmentKanbansEnabled,
  deptText,
  getDepartment,
  getDepartmentPath,
  CAMPAIGNS_ID,
  PERSONAL_DEPARTMENT_ID,
  PERSONAL_HUB_PATH,
  newTaskDraft,
  serializePeopleParam,
  parsePeopleParam,
  parseSubtypeParam,
  taskMatchesPeopleFilter,
  taskMatchesSubtypeFilter,
  taskBelongsToDepartment,
  internalTasksUrl,
} from '@/lib/internal';
import {
  departmentJotDownUrl,
  isJotDownTool,
  KNOWLEDGE_BANK_TOOL,
} from '@/lib/knowledge';
import { canCreateTaskInDepartment, canDeleteTask, canDeleteBoard, canDeleteCampaign, hubActorFromClient } from '@/lib/hub-permissions';
import { filterTasksByBucket } from '@/lib/internal-buckets';
import { personKey } from '@/lib/appdev';
import { countPersonalHubStats, countOpenAssignedTasks } from '@/lib/personal-hub-stats';
import { taskOriginUrl } from '@/lib/task-origin-url';
import { useHubSessionProfile } from '@/hooks/useHubSession';
import { signalHubNavigationReady } from '@/lib/hub-site-loader';
import { signalHubNotificationsRefresh } from '@/lib/hub-notifications-ui';

import InternalBoard from '@/components/internal/InternalBoard';
const CampaignsWorkspace = dynamic(() => import('@/components/internal/CampaignsWorkspace'));
const TaskPanel = dynamic(() => import('@/components/internal/TaskPanel'), { ssr: false });
const CampaignFlowCanvas = dynamic(() => import('@/components/internal/CampaignFlowCanvas'), { ssr: false });
const PersonalJotDownWorkspace = dynamic(() => import('@/components/personal/PersonalJotDownWorkspace'), { ssr: false });
const DepartmentJotDownWorkspace = dynamic(() => import('@/components/jot/DepartmentJotDownWorkspace'), { ssr: false });
const ProductsWorkspace = dynamic(() => import('@/components/products/ProductsWorkspace'), { ssr: false });

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
  initialTasksLoadError = null,
  opsData = null,
  shopifyConfigured = false,
  shopifySnapshot = null,
  marketingRows = [],
  initialCampaigns = [],
  initialBoard = null,
  initialCampaign = null,
  initialProducts = null,
  initialProductDetail = null,
  initialKolPool = null,
  initialPersonalJots = [],
  initialDepartmentJots = [],
  initialExpenses = [],
  initialMe = null,
  initialDeptBoards = null,
  initialPersonalBoards = null,
  initialTeamMembers = null,
  initialTeamMembersReady = false,
}) {
  const dept = getDepartment(departmentId);
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const { toast, toastStack } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathTool = marketingToolFromPathname(pathname);
  const clientDeptTools =
    (departmentId === 'marketing' && pathname.startsWith('/marketing'))
    || (departmentId === 'operations' && pathname === '/ops');
  const toolFromUrl = useMemo(() => {
    if (departmentId === 'marketing') {
      return pathTool || searchParams.get('tool') || initialTool || 'kol-pool';
    }
    if (departmentId === 'operations' && pathname === '/ops') {
      return searchParams.get('tool') || initialTool || 'dashboard';
    }
    return searchParams.get('tool') || initialTool || '';
  }, [departmentId, pathTool, pathname, searchParams, initialTool]);
  const [deptToolClient, setDeptToolClient] = useState('');
  const toolParam = clientDeptTools ? (deptToolClient || toolFromUrl) : toolFromUrl;
  const viewParam = searchParams.get('view') || initialBucket || '';
  const boardParam = searchParams.get('board') || '';
  const flowParam = searchParams.get('flow') || '';
  const cviewParam = searchParams.get('cview') || '';
  const pageParam = searchParams.get('page') || '';
  const jotParam = searchParams.get('jot') || searchParams.get('page') || '';
  const productParam = searchParams.get('product') || '';
  const tabParam = searchParams.get('tab') || 'overview';
  const productsMode = departmentId === 'products';
  const personalMode = departmentId === PERSONAL_DEPARTMENT_ID;
  const campaignsMode = departmentId === CAMPAIGNS_ID;
  const deptBasePath = (personalMode ? PERSONAL_HUB_PATH : getDepartmentPath(departmentId)).split('?')[0];
  const clientDeptBoardNav = departmentKanbansEnabled(departmentId)
    && pathname === deptBasePath
    && !campaignsMode;
  const [boardClient, setBoardClient] = useState('');
  const effectiveBoardParam = clientDeptBoardNav && boardClient ? boardClient : boardParam;
  const campaignListOnly = campaignsMode && !boardParam && !flowParam;
  const deptBase = personalMode
    ? PERSONAL_HUB_PATH
    : departmentId === CAMPAIGNS_ID
      ? campaignListHomeUrl()
      : getDepartmentPath(departmentId);
  const shouldLoadTasks = Boolean(
    effectiveBoardParam ||
    flowParam ||
    (departmentId === 'all' && !campaignListOnly) ||
    (personalMode && toolParam !== PERSONAL_JOT_DOWN_TOOL) ||
    (departmentId === 'marketing' && toolParam === 'kol-outreach')
  );

  const view = BUCKET_VIEWS.includes(viewParam)
    ? 'list'
    : (TASK_VIEWS.includes(viewParam) ? viewParam : 'board');
  const activePeople = useMemo(
    () => parsePeopleParam(searchParams.get('people')),
    [searchParams]
  );
  const activeSubtype = useMemo(
    () => parseSubtypeParam(searchParams.get('subtype')),
    [searchParams]
  );

  const personalAssignedHome = personalMode && !effectiveBoardParam && !flowParam && toolParam !== PERSONAL_JOT_DOWN_TOOL;
  const clientSideBucketViews = personalAssignedHome || departmentId === 'all';
  const tasksQueryViewParam = clientSideBucketViews ? '' : viewParam;

  const { tasks, refresh, mergeTask, removeTask } = useInternalTasks({
    departmentId,
    viewParam: tasksQueryViewParam,
    boardId: effectiveBoardParam || (toolParam === 'kol-outreach' ? KOL_OUTREACH_BOARD_ID : ''),
    campaignId: flowParam,
    flowOnly: Boolean(flowParam),
    initialTasks: shouldLoadTasks ? initialTasks : null,
    initialTasksFilterKey: shouldLoadTasks ? initialTasksFilterKey : null,
    enabled: shouldLoadTasks,
  });

  const outreachToolView = departmentId === 'marketing' && toolParam === 'kol-outreach';

  const setDeptTool = useCallback((toolId) => {
    setDeptToolClient(toolId);
    if (typeof window === 'undefined') return;
    const url = departmentId === 'marketing'
      ? marketingToolPath(toolId)
      : `/ops?tool=${encodeURIComponent(toolId)}`;
    window.history.replaceState(window.history.state, '', url);
  }, [departmentId]);

  useEffect(() => {
    if (!clientDeptTools) return;
    setDeptToolClient('');
  }, [pathname, searchParams.toString(), clientDeptTools]);

  useEffect(() => {
    if (!clientDeptTools) return;
    const onPopState = () => {
      if (departmentId === 'marketing') {
        setDeptToolClient(marketingToolFromPathname(window.location.pathname) || 'kol-pool');
        return;
      }
      setDeptToolClient(new URLSearchParams(window.location.search).get('tool') || 'dashboard');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [clientDeptTools, departmentId]);

  const [panelTask, setPanelTask] = useState(null);
  const { closePanel: closeTaskPanel } = useTaskDeepLink({
    tasks,
    panelTask,
    setPanelTask,
    enabled: !outreachToolView,
  });
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [teamMembers, setTeamMembers] = useState(() => initialTeamMembers || []);
  const sessionProfile = useHubSessionProfile();
  const seededMe = initialMe ?? (sessionProfile
    ? { displayName: sessionProfile.displayName || '', hubUser: sessionProfile.hubUser }
    : null);
  const [me, setMe] = useState(() => seededMe ?? { displayName: '' });
  const actor = useMemo(() => hubActorFromClient(me), [me]);
  const permissions = me.hubUser?.permissions;
  const canEditBoard = permissions?.canEditBoardConfig ?? false;
  const canCreateProduct = permissions?.canCreateProduct ?? false;
  const [activeBoard, setActiveBoard] = useState(initialBoard);
  const [boardFetchSettled, setBoardFetchSettled] = useState(() => Boolean(initialBoard));
  const [flowFetchSettled, setFlowFetchSettled] = useState(() => Boolean(initialCampaign));
  const [activeCampaign, setActiveCampaign] = useState(initialCampaign);
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);
  const [kanbanCreateOpen, setKanbanCreateOpen] = useState(false);
  const [flowDataVersion, setFlowDataVersion] = useState(0);

  useEffect(() => {
    signalHubNavigationReady();
  }, [departmentId]);

  useEffect(() => {
    setActiveBoard(initialBoard);
    setBoardFetchSettled(Boolean(initialBoard));
    setStatusEditorOpen(false);
  }, [initialBoard]);

  const setDeptBoard = useCallback((boardId) => {
    setBoardClient(boardId);
    if (typeof window === 'undefined') return;
    const url = personalMode
      ? personalBoardUrl(boardId)
      : departmentBoardUrl(deptBasePath, boardId);
    window.history.replaceState(window.history.state, '', url);
  }, [personalMode, deptBasePath]);

  useEffect(() => {
    if (!clientDeptBoardNav) return;
    setBoardClient('');
  }, [boardParam, clientDeptBoardNav]);

  useEffect(() => {
    if (!clientDeptBoardNav) return;
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setBoardClient(params.get('board') || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [clientDeptBoardNav]);

  const seededBoard = useMemo(() => {
    if (!effectiveBoardParam) return null;
    if (initialBoard?.id === effectiveBoardParam) return initialBoard;
    const fromPersonal = initialPersonalBoards?.find(board => board.id === effectiveBoardParam);
    if (fromPersonal) return fromPersonal;
    const fromDept = initialDeptBoards?.find(board => board.id === effectiveBoardParam);
    if (fromDept) return fromDept;
    if (campaignsMode && initialCampaigns?.length) {
      for (const campaign of initialCampaigns) {
        const board = campaign.boards?.find(item => item.id === effectiveBoardParam);
        if (board) return { ...board, campaign };
      }
    }
    return null;
  }, [effectiveBoardParam, initialBoard, initialPersonalBoards, initialDeptBoards, campaignsMode, initialCampaigns]);

  const resolvedBoard = useMemo(() => {
    if (!effectiveBoardParam) return null;
    if (activeBoard?.id === effectiveBoardParam) return activeBoard;
    return seededBoard;
  }, [effectiveBoardParam, activeBoard, seededBoard]);

  useEffect(() => {
    if (!effectiveBoardParam) {
      if (!initialBoard) setActiveBoard(null);
      setBoardFetchSettled(false);
      return undefined;
    }
    if (seededBoard) {
      setActiveBoard(seededBoard);
      setBoardFetchSettled(true);
      return undefined;
    }

    let cancelled = false;
    setBoardFetchSettled(false);
    fetch(API_V1.internalBoard(effectiveBoardParam), { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (cancelled) return;
        const data = unwrapData(body);
        if (data?.board) setActiveBoard(data.board);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBoardFetchSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveBoardParam, initialBoard, seededBoard]);

  const seededCampaign = useMemo(() => {
    if (!flowParam) return null;
    if (initialCampaign?.id === flowParam) return initialCampaign;
    return initialCampaigns?.find(campaign => campaign.id === flowParam) || null;
  }, [flowParam, initialCampaign, initialCampaigns]);

  const resolvedCampaign = useMemo(() => {
    if (!flowParam) return null;
    if (activeCampaign?.id === flowParam) return activeCampaign;
    return seededCampaign;
  }, [flowParam, activeCampaign, seededCampaign]);

  const kanbanPickerDepartment =
    activeCampaign?.department
    || (departmentId !== 'all' && departmentId !== CAMPAIGNS_ID ? departmentId : 'marketing');
  const { boards: kanbansNotOnFlow, loading: kanbanPickerLoading } = useFlowKanbanPickerBoards({
    open: kanbanCreateOpen,
    department: kanbanPickerDepartment,
    campaignBoards: activeCampaign?.boards,
    flowData: activeCampaign?.flow_data,
  });

  useEffect(() => {
    if (!flowParam) {
      if (!initialCampaign) setActiveCampaign(null);
      setFlowFetchSettled(false);
      return undefined;
    }
    if (seededCampaign) {
      setActiveCampaign(seededCampaign);
    }

    let cancelled = false;
    setFlowFetchSettled(false);
    fetch(API_V1.internalCampaign(flowParam), { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (cancelled) return;
        const data = unwrapData(body);
        if (data?.campaign) setActiveCampaign(data.campaign);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFlowFetchSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [flowParam, initialCampaign, seededCampaign]);

  useEffect(() => {
    setActiveCampaign(initialCampaign);
  }, [initialCampaign]);

  useEffect(() => {
    if (initialTasksLoadError) {
      toast.error(t('hub.internal.tasksLoadError'));
    }
  }, [initialTasksLoadError, t, toast]);

  const boardView = Boolean(effectiveBoardParam && resolvedBoard);
  const flowView = Boolean(flowParam && resolvedCampaign);
  const createScopeDepartment = useMemo(() => {
    if (personalMode) return PERSONAL_DEPARTMENT_ID;
    if (boardView && resolvedBoard?.department) return resolvedBoard.department;
    if (flowView && resolvedCampaign?.department) return resolvedCampaign.department;
    if (departmentId === 'all' || departmentId === CAMPAIGNS_ID) return null;
    return departmentId;
  }, [
    personalMode,
    boardView,
    resolvedBoard?.department,
    flowView,
    resolvedCampaign?.department,
    departmentId,
  ]);
  const canCreate = useMemo(
    () => Boolean(createScopeDepartment && actor && canCreateTaskInDepartment(actor, createScopeDepartment)),
    [actor, createScopeDepartment]
  );
  const flowCview = FLOW_CVIEW.includes(cviewParam) ? cviewParam : 'flow';
  const boardCview = cviewParam === 'list' ? 'list' : 'board';

  useEffect(() => {
    if (seededMe?.hubUser?.permissions) {
      setMe(seededMe);
      return undefined;
    }
    let cancelled = false;
    fetch('/api/auth/me?scope=hub', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data?.displayName) return;
        setMe({ displayName: data.displayName, hubUser: data.hubUser });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seededMe?.displayName, seededMe?.hubUser?.id, seededMe?.hubUser?.permissions]);

  useEffect(() => {
    if (initialTeamMembersReady) return;
    fetch(API_V1.hubTeamMembers, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const data = unwrapData(body, 'members');
        const members = Array.isArray(data?.members) ? data.members : Array.isArray(data) ? data : [];
        if (members.length) setTeamMembers(members);
      })
      .catch(() => {});
  }, [initialTeamMembersReady]);

  useEffect(() => {
    if (personalMode) return;
    if (departmentId === 'products') return;
    if (departmentId === 'marketing' && boardParam === KOL_OUTREACH_BOARD_ID) {
      router.replace(marketingKolOutreachUrl());
      return;
    }
    if (toolParam === KNOWLEDGE_BANK_TOOL) {
      router.replace(departmentJotDownUrl(deptBase, { jotId: jotParam }));
      return;
    }
    if (departmentId === 'marketing' && !toolParam && !boardParam && !flowParam && !initialTool) {
      router.replace(marketingToolPath('kol-pool'));
      return;
    }
    if (boardParam || toolParam || flowParam || initialTool) return;
    if (dept?.dataLinks?.length && !departmentKanbansEnabled(departmentId)) {
      router.replace(dept.dataLinks[0].href);
      return;
    }
    router.replace(departmentJotDownUrl(getDepartmentPath(departmentId)));
  }, [toolParam, boardParam, flowParam, dept, router, departmentId, initialTool, personalMode, jotParam, deptBase]);

  const lockBoard = boardView && resolvedBoard
    ? { board_id: resolvedBoard.id, campaign_id: resolvedBoard.campaign_id || resolvedBoard.campaign?.id || null }
    : null;

  const lockFlow = flowView && resolvedCampaign
    ? { board_id: null, campaign_id: resolvedCampaign.id }
    : null;

  const boardStatusCols = useMemo(
    () => (boardView && resolvedBoard ? boardStatusColumns(resolvedBoard) : null),
    [boardView, resolvedBoard]
  );

  const flowStatusCols = useMemo(
    () => (flowView ? flowStatusColumns() : null),
    [flowView]
  );

  const filtered = useMemo(() => {
    if (departmentId === 'all') return tasks;
    if (boardView && resolvedBoard?.id) {
      return tasks.filter(task => task.board_id === resolvedBoard.id);
    }
    if (personalMode && !boardView && !flowView) return tasks;
    if (boardView || flowView) return tasks;
    return tasks.filter(task => taskBelongsToDepartment(task, departmentId));
  }, [tasks, departmentId, personalMode, boardView, flowView, resolvedBoard?.id]);

  const baseTaskItems = useMemo(
    () => filtered.filter(task => task.kind === 'task' && task.status !== 'archived'),
    [filtered]
  );

  const taskItems = useMemo(() => {
    let items = personalAssignedHome
      ? baseTaskItems
      : baseTaskItems.filter(task => taskMatchesPeopleFilter(task, activePeople));
    if (activeSubtype) {
      items = items.filter(task => taskMatchesSubtypeFilter(task, activeSubtype));
    }
    return items;
  }, [baseTaskItems, activePeople, activeSubtype, personalAssignedHome]);

  const activeBucket = BUCKET_VIEWS.includes(viewParam) ? viewParam : '';
  const listTaskItems = useMemo(() => {
    if (!clientSideBucketViews || !activeBucket) return taskItems;
    return filterTasksByBucket(taskItems, activeBucket);
  }, [clientSideBucketViews, activeBucket, taskItems]);

  const flowItems = useMemo(
    () => filtered.filter(
      item => (item.kind === 'task' || item.kind === 'milestone')
        && item.status !== 'archived'
        && taskMatchesPeopleFilter(item, activePeople)
    ),
    [filtered, activePeople]
  );

  const workspaceItems = flowView ? flowItems : taskItems;

  const peopleOptions = useMemo(
    () => collectPeopleFromTasks(
      filtered.filter(task => task.kind === 'task' && task.status !== 'archived')
    ),
    [filtered]
  );

  const subtypeOptions = useMemo(
    () => collectSubtypesFromTasks(baseTaskItems),
    [baseTaskItems]
  );

  const boardFilterParams = useMemo(
    () => ({
      people: serializePeopleParam(activePeople),
      subtype: activeSubtype,
    }),
    [activePeople, activeSubtype]
  );

  const flowTaskFilterUrl = useCallback(
    ({ people, subtype }) => campaignFlowUrl(resolvedCampaign?.id, flowCview, {
      people,
      subtype: subtype ?? activeSubtype,
    }),
    [resolvedCampaign?.id, flowCview, activeSubtype]
  );

  const boardTaskFilterUrl = useCallback(
    ({ people, subtype }) => boardUrlForContext({
      campaignsMode,
      deptPath: deptBase,
      boardId: resolvedBoard?.id,
      cview: boardCview,
      people,
      subtype: subtype ?? activeSubtype,
      personalMode,
    }),
    [resolvedBoard?.id, boardCview, campaignsMode, deptBase, personalMode, activeSubtype]
  );

  const flowStatusLabel = useCallback(
    statusId => {
      const col = flowStatusCols?.find(c => c.id === statusId);
      return col ? statusColumnLabel(col, t) : statusId;
    },
    [flowStatusCols, t]
  );

  function boardViewHref(viewId) {
    return boardUrlForContext({
      campaignsMode,
      deptPath: deptBase,
      boardId: resolvedBoard?.id,
      cview: viewId,
      people: boardFilterParams.people,
      subtype: boardFilterParams.subtype,
      personalMode,
    });
  }

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
        const body = await res.json();
        const data = unwrapData(body, 'task');
        const saved = data?.task || data;
        if (saved?.id) {
          mergeTask(saved);
          if (flowView && activeCampaign && isNew) {
            await appendFlowNode(saved);
          }
        }
        closeTaskPanel();
        signalHubNotificationsRefresh();
      } else {
        toast.error(t('common.somethingWrong'));
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
    await saveFlowFromParent({
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
    if (updated?.id) mergeTask(updated);
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
      if (updated?.id) {
        mergeTask(updated);
        setPanelTask(updated);
      }
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
    const res = await fetch(API_V1.internalTask(id), { method: 'DELETE', credentials: 'same-origin' });
    if (!res.ok) {
      toast.error(t('common.somethingWrong'));
      return;
    }
    closeTaskPanel();
    removeTask(id);
  }

  async function handleDeleteBoard() {
    if (!resolvedBoard?.id) return;
    const ok = await requestConfirm({
      title: t('hub.internal.deleteBoard'),
      message: t('hub.internal.deleteBoardConfirm').replace('{name}', resolvedBoard.name),
      confirmLabel: t('hub.internal.taskPanel.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(API_V1.internalBoard(resolvedBoard.id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      dispatchBoardsChanged();
      toast.success(t('hub.internal.boardDeleted'));
      if (personalMode) {
        router.push('/me');
      } else if (campaignsMode || resolvedBoard.campaign_id) {
        router.push(campaignListHomeUrl());
      } else {
        router.push(deptBase);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCampaign() {
    if (!activeCampaign?.id) return;
    const ok = await requestConfirm({
      title: t('hub.internal.deleteCampaign'),
      message: t('hub.internal.deleteCampaignConfirm').replace('{name}', activeCampaign.name),
      confirmLabel: t('hub.internal.taskPanel.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(API_V1.internalCampaign(activeCampaign.id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      toast.success(t('hub.internal.campaignDeleted'));
      router.push(campaignListHomeUrl());
    } finally {
      setSaving(false);
    }
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
      if (task?.id) {
        mergeTask(task);
        setPanelTask(task);
        signalHubNotificationsRefresh();
      }
    } finally {
      setPostingComment(false);
    }
  }

  function openNew(kind = 'task') {
    const defaultStatus = boardStatusCols?.[0]?.id || flowStatusCols?.[0]?.id || 'todo';
    const lock = lockBoard || lockFlow;
    const onPersonalBoard = personalMode && Boolean(lock?.board_id);
    setPanelTask(newTaskDraft({
      department: personalMode
        ? PERSONAL_DEPARTMENT_ID
        : (departmentId === 'all' || campaignsMode ? 'operations' : departmentId),
      visibility: onPersonalBoard ? 'private' : 'team',
      owner: onPersonalBoard ? me.displayName : '',
      status: defaultStatus,
      kind,
      assignee: personalMode ? me.displayName : '',
      board_id: lock?.board_id || null,
      campaign_id: lock?.campaign_id || null,
    }));
  }

  async function handleAddKanbanNode() {
    if (!activeCampaign?.id) return;
    setKanbanCreateOpen(true);
  }

  async function handleAddExistingKanban(board) {
    if (!board?.id || !activeCampaign?.id) return;
    const prevFlow = activeCampaign.flow_data;
    const nextFlow = appendKanbanNodeToFlow(prevFlow, board);
    if (nextFlow === prevFlow) {
      setKanbanCreateOpen(false);
      return;
    }
    setKanbanCreateOpen(false);
    setSaving(true);
    try {
      const ok = await saveFlowFromParent(nextFlow);
      if (ok) {
        toast.success(t('hub.internal.kanbanAddedToFlow'));
      } else {
        setActiveCampaign(prev => (prev ? { ...prev, flow_data: prevFlow } : prev));
        setFlowDataVersion(version => version + 1);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmCampaignKanban({ name, department }) {
    if (!name || !activeCampaign?.id) return;
    setSaving(true);
    try {
      const res = await fetch(API_V1.internalCampaignBoards(activeCampaign.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, department }),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const body = await res.json();
      const data = unwrapData(body);
      const board = data?.board;
      if (!board?.id) return;
      dispatchBoardsChanged();
      const nextFlow = appendKanbanNodeToFlow(activeCampaign.flow_data, board, name);
      const ok = await saveFlowFromParent(nextFlow);
      if (!ok) return;
      setActiveCampaign(prev => ({
        ...prev,
        boards: [...(prev?.boards || []), board],
      }));
      setKanbanCreateOpen(false);
      toast.success(t('hub.internal.boardCreated'));
    } finally {
      setSaving(false);
    }
  }

  const patchFlowData = useCallback(async flowData => {
    if (!activeCampaign?.id) return false;
    try {
      const res = await fetch(API_V1.internalCampaign(activeCampaign.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ flow_data: flowData }),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return false;
      }
      const body = await res.json();
      const data = unwrapData(body);
      if (data?.campaign) {
        setActiveCampaign(data.campaign);
      } else {
        setActiveCampaign(prev => (prev ? { ...prev, flow_data: flowData } : prev));
      }
      return true;
    } catch {
      toast.error(t('common.somethingWrong'));
      return false;
    }
  }, [activeCampaign?.id, t, toast]);

  const saveFlowFromParent = useCallback(async flowData => {
    setFlowDataVersion(version => version + 1);
    setActiveCampaign(prev => (prev ? { ...prev, flow_data: flowData } : prev));
    const ok = await patchFlowData(flowData);
    if (!ok) setFlowDataVersion(version => version + 1);
    return ok;
  }, [patchFlowData]);

  const handleSaveFlowData = useCallback(async flowData => {
    if (!activeCampaign?.id) return false;
    try {
      const res = await fetch(API_V1.internalCampaign(activeCampaign.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ flow_data: flowData }),
      });
      if (res.ok) {
        setActiveCampaign(prev => (prev ? { ...prev, flow_data: flowData } : prev));
        return true;
      }
      toast.error(t('common.somethingWrong'));
      return false;
    } catch {
      toast.error(t('common.somethingWrong'));
      return false;
    }
  }, [activeCampaign?.id, t, toast]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const sidebarMode = personalMode
    ? 'personal'
    : departmentId === 'all'
      ? 'all-tasks'
      : departmentId === CAMPAIGNS_ID
        ? 'campaigns'
        : 'department';

  function viewHref(viewId) {
    return internalTasksUrl(deptBase, { view: viewId, people: activePeople });
  }

  const personalHomeSection = personalMode && !boardView && !toolParam;
  const jotDownView = personalMode && toolParam === PERSONAL_JOT_DOWN_TOOL && !boardView;
  const deptJotDownView = !personalMode && isJotDownTool(toolParam) && !boardView;

  useEffect(() => {
    if (!personalHomeSection || boardParam || view !== 'board') return;
    router.replace(internalTasksUrl(PERSONAL_HUB_PATH, { view: 'list', people: activePeople }));
  }, [personalHomeSection, boardParam, view, router, activePeople]);

  function handleAssignedTaskClick(task) {
    router.push(taskOriginUrl(task));
  }

  function isTaskViewActive(viewId) {
    if (toolParam) return false;
    if (BUCKET_VIEWS.includes(viewId)) return viewParam === viewId;
    const defaultView = personalHomeSection ? 'list' : 'board';
    return viewParam === viewId || (!viewParam && viewId === defaultView);
  }

  function isToolActive(toolId) {
    return toolParam === toolId;
  }

  const deptTaskSection = (departmentId === 'all' || personalHomeSection) && !toolParam && !campaignsMode && !boardView;
  const boardTaskSection = boardView;
  const flowTaskSection = flowView;
  const personalStats = useMemo(
    () => (personalHomeSection ? countPersonalHubStats(baseTaskItems) : null),
    [personalHomeSection, baseTaskItems]
  );

  const personalAssignedCount = useMemo(
    () => (personalMode ? countOpenAssignedTasks(tasks, actor) : 0),
    [personalMode, tasks, actor]
  );
  const ownsActiveBoard = boardView
    && resolvedBoard
    && personKey(resolvedBoard.owner_key || resolvedBoard.created_by) === personKey(me.displayName);
  const canEditBoardFields = canEditBoard || ownsActiveBoard;

  const canCreateOnBoard = useMemo(() => {
    if (boardView && ownsActiveBoard && me.displayName && !me.hubUser?.mustChangePassword) {
      return true;
    }
    return canCreate;
  }, [boardView, ownsActiveBoard, me.displayName, me.hubUser?.mustChangePassword, canCreate]);

  const canDeleteActiveBoard = useMemo(
    () => Boolean(boardView && resolvedBoard && actor && canDeleteBoard(actor, resolvedBoard)),
    [boardView, resolvedBoard, actor]
  );

  const canDeleteActiveCampaign = useMemo(
    () => Boolean(flowView && resolvedCampaign && actor && canDeleteCampaign(actor, resolvedCampaign)),
    [flowView, resolvedCampaign, actor]
  );

  const flowViews = [
    { id: 'flow', label: t('hub.internal.viewFlow'), icon: 'flow' },
    { id: 'board', label: t('hub.internal.viewBoard'), icon: 'kanban' },
    { id: 'list', label: t('hub.internal.viewList'), icon: 'layout' },
  ];

  const taskViews = [
    { id: 'board', label: t('hub.internal.viewBoard'), icon: 'kanban' },
    { id: 'list', label: t('hub.internal.viewList'), icon: 'layout' },
  ];

  const topNavTitle = boardView
    ? resolvedBoard.name
    : flowView
      ? `${resolvedCampaign.name} · ${t('hub.internal.viewFlow')}`
    : campaignListOnly
      ? t('hub.internal.campaignList')
      : personalHomeSection
        ? t('hub.personal.assignedTitle')
      : jotDownView
        ? t('hub.jotDown.title')
      : deptJotDownView
        ? t('hub.jotDown.title')
      : toolParam && dept?.dataLinks?.find(link => link.id === toolParam)
        ? dataLinkLabel(dept.dataLinks.find(link => link.id === toolParam), t)
      : departmentId === 'all'
      ? t('hub.internal.allTasks')
      : (dept ? deptText(dept, t, 'label') : '');

  if (!dept && departmentId !== 'all' && departmentId !== CAMPAIGNS_ID && !personalMode) {
    return <p>Department not found.</p>;
  }

  return (
    <HubLayout
      className="internal-dept-layout"
      topNavTitle={topNavTitle}
      authEnabled={authEnabled}
      displayName={me.displayName}
      onLogout={handleLogout}
      sidebarClassName="internal-dept-sidebar"
      sidebarLabel={personalMode
        ? t('hub.personal.title')
        : departmentId === 'all'
        ? t('hub.internal.allTasks')
        : campaignsMode
          ? t('hub.internal.campaignList')
          : (dept ? t(dept.labelKey) : '')}
      sidebar={
        <InternalSidebar
          mode={sidebarMode}
          departmentId={departmentId}
          isToolActive={isToolActive}
          toolParam={toolParam}
          pageParam={pageParam}
          boardParam={effectiveBoardParam}
          clientDeptBoardNav={clientDeptBoardNav}
          onDeptBoardChange={clientDeptBoardNav ? setDeptBoard : null}
          flowParam={flowParam}
          personalAssignedCount={personalAssignedCount}
          initialDeptBoards={initialDeptBoards}
          initialPersonalBoards={initialPersonalBoards}
          initialHubUser={me.hubUser ?? seededMe?.hubUser}
          clientDeptTools={clientDeptTools}
          onDeptToolChange={clientDeptTools ? setDeptTool : null}
        />
      }
    >
      <main className="main internal-dept-main">
        {initialTasksLoadError ? (
          <div className="personal-hub-alert" role="alert">
            {t('hub.internal.tasksLoadError')}
          </div>
        ) : null}
        {personalHomeSection && personalStats ? (
          <>
            <section className="internal-kpi-row personal-kpis">
              <Link href={internalTasksUrl(PERSONAL_HUB_PATH, { view: 'list' })} className="internal-kpi internal-kpi-total">
                <span className="internal-kpi-val">{personalStats.assigned}</span>
                <span>{t('hub.personal.kpiAssigned')}</span>
              </Link>
              <Link href={internalTasksUrl(PERSONAL_HUB_PATH, { view: 'today' })} className="internal-kpi">
                <span className="internal-kpi-val">{personalStats.today}</span>
                <span>{t('hub.personal.kpiToday')}</span>
              </Link>
              <Link href={internalTasksUrl(PERSONAL_HUB_PATH, { view: 'overdue' })} className="internal-kpi is-warn">
                <span className="internal-kpi-val">{personalStats.overdue}</span>
                <span>{t('hub.personal.kpiOverdue')}</span>
              </Link>
              <Link href={internalTasksUrl(PERSONAL_HUB_PATH, { view: 'in_progress' })} className="internal-kpi">
                <span className="internal-kpi-val">{personalStats.inProgress}</span>
                <span>{t('hub.personal.kpiInProgress')}</span>
              </Link>
              <Link href={internalTasksUrl(PERSONAL_HUB_PATH, { view: 'bank' })} className="internal-kpi">
                <span className="internal-kpi-val">{personalStats.bank}</span>
                <span>{t('hub.personal.kpiBank')}</span>
              </Link>
            </section>
            <p className="personal-hub-assigned-hint">{t('hub.personal.assignedHint')}</p>
          </>
        ) : null}
        {boardView && resolvedBoard?.campaign?.name ? (
          <div className="internal-board-toolbar">
            <span className="internal-board-context">{resolvedBoard.campaign.name}</span>
          </div>
        ) : null}

        {flowView && resolvedCampaign?.name ? (
          <div className="internal-board-toolbar">
            <span className="internal-board-context">
              {t('hub.internal.campaignFlowChip').replace('{name}', resolvedCampaign.name)}
            </span>
          </div>
        ) : null}

        {flowTaskSection && (
          <div className="internal-dept-toolbar internal-dept-toolbar--board">
            <div className="internal-dept-view-tabs" role="toolbar" aria-label={t('hub.internal.flow')}>
              {flowViews.map(({ id, label, icon }) => (
                <Link
                  key={id}
                  href={campaignFlowUrl(resolvedCampaign.id, id, boardFilterParams)}
                  className={`internal-dept-view-tab${flowCview === id ? ' is-active' : ''}`}
                  aria-current={flowCview === id ? 'page' : undefined}
                >
                  <Icon name={icon} size={15} />
                  {label}
                </Link>
              ))}
            </div>
            {canEditBoard ? (
            <button
              type="button"
              className="appdev-btn-ghost"
              onClick={handleAddKanbanNode}
              disabled={saving}
            >
              <Icon name="kanban" size={16} />
              {t('hub.internal.addKanbanNode')}
            </button>
            ) : null}
            {canCreate ? (
            <>
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
            </>
            ) : null}
            {canDeleteActiveCampaign ? (
            <button
              type="button"
              className="appdev-btn-ghost is-danger"
              onClick={handleDeleteCampaign}
              disabled={saving}
            >
              <Icon name="x" size={16} />
              {t('hub.internal.deleteCampaign')}
            </button>
            ) : null}
          </div>
        )}

        {boardTaskSection && (
          <div className="internal-dept-toolbar internal-dept-toolbar--board">
            <div className="internal-dept-view-tabs" role="toolbar" aria-label={t('hub.internal.viewBoard')}>
              {taskViews.map(({ id, label, icon }) => (
                <Link
                  key={id}
                  href={boardViewHref(id)}
                  className={`internal-dept-view-tab${boardCview === id ? ' is-active' : ''}`}
                  aria-current={boardCview === id ? 'page' : undefined}
                >
                  <Icon name={icon} size={15} />
                  {label}
                </Link>
              ))}
            </div>
            {canEditBoardFields ? (
            <button
              type="button"
              className="appdev-btn-ghost"
              onClick={() => setStatusEditorOpen(open => !open)}
            >
              {t('hub.internal.editBoardFields')}
            </button>
            ) : null}
            {canDeleteActiveBoard ? (
            <button
              type="button"
              className="appdev-btn-ghost is-danger"
              onClick={handleDeleteBoard}
              disabled={saving}
            >
              <Icon name="x" size={16} />
              {t('hub.internal.deleteBoard')}
            </button>
            ) : null}
            {canCreateOnBoard ? (
            <button
              type="button"
              className="appdev-btn-primary internal-add-btn"
              onClick={() => openNew()}
              disabled={saving}
            >
              <Icon name="plus" size={16} />
              {t('hub.internal.addTaskIssue')}
            </button>
            ) : null}
          </div>
        )}

        {statusEditorOpen && resolvedBoard && (
          <BoardStatusEditor
            board={resolvedBoard}
            tasks={taskItems}
            onSaved={setActiveBoard}
            onClose={() => setStatusEditorOpen(false)}
          />
        )}

        {deptTaskSection && !personalHomeSection && (
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
            {departmentId !== 'all' && !personalHomeSection && canCreate ? (
              <button
                type="button"
                className="appdev-btn-primary internal-add-btn"
                onClick={() => openNew()}
                disabled={saving}
              >
                <Icon name="plus" size={16} />
                {t('hub.internal.addTaskIssue')}
              </button>
            ) : null}
          </div>
        )}

        {(flowTaskSection || boardTaskSection) && (
          <InternalTaskFilters
            deptBase={deptBase}
            activePeople={activePeople}
            activeSubtype={activeSubtype}
            people={peopleOptions}
            subtypes={subtypeOptions}
            currentUserName={me.displayName}
            getTaskUrl={flowTaskSection ? flowTaskFilterUrl : boardTaskFilterUrl}
            peopleOnly
          />
        )}

        {deptTaskSection && (
          <InternalTaskFilters
            deptBase={deptBase}
            activeView={BUCKET_VIEWS.includes(viewParam) ? viewParam : ''}
            taskView={view}
            activePeople={activePeople}
            activeSubtype={activeSubtype}
            people={peopleOptions}
            subtypes={subtypeOptions}
            currentUserName={me.displayName}
            hidePeople={personalHomeSection}
          />
        )}

        {effectiveBoardParam && boardFetchSettled && !resolvedBoard && (
          <p className="internal-empty">{t('hub.internal.boardNotFound')}</p>
        )}

        {flowParam && flowFetchSettled && !resolvedCampaign && (
          <p className="internal-empty">{t('hub.internal.flowNotFound')}</p>
        )}

        {campaignListOnly && (
          <CampaignsWorkspace initialCampaigns={initialCampaigns} />
        )}

        {departmentId === 'marketing' && !boardView && (
          <MarketingHubContent
            view={toolParam}
            initialRows={marketingRows}
            initialKolPool={initialKolPool}
            outreachTasks={tasks}
            onOutreachTasksChanged={refresh}
            canCreate={canCreate}
            displayName={me.displayName}
            teamMembers={teamMembers}
          />
        )}

        {departmentId === 'operations' && !isJotDownTool(toolParam) && !boardView && (
          <>
            <div hidden={toolParam !== 'stock'} aria-hidden={toolParam !== 'stock'}>
              {opsData ? (
                <OpsStockPanel
                  initialOps={opsData}
                  shopifyConfigured={shopifyConfigured}
                  shopifySnapshot={shopifySnapshot}
                />
              ) : null}
            </div>
            <div hidden={toolParam !== 'expenses'} aria-hidden={toolParam !== 'expenses'}>
              <OpsExpensesPanel initialExpenses={initialExpenses} />
            </div>
            <div hidden={toolParam === 'stock' || toolParam === 'expenses'} aria-hidden={toolParam === 'stock' || toolParam === 'expenses'}>
              {opsData ? (
                <OpsHubContent initialData={opsData} view={toolParam} />
              ) : null}
            </div>
          </>
        )}

        {deptJotDownView && (
          <DepartmentJotDownWorkspace
            departmentId={departmentId}
            deptBase={deptBase}
            initialJots={initialDepartmentJots}
            activeJotId={jotParam}
          />
        )}

        {jotDownView && (
          <PersonalJotDownWorkspace
            initialJots={initialPersonalJots}
            activeJotId={jotParam}
          />
        )}

        {productsMode && !boardView && (
          <ProductsWorkspace
            initialProducts={initialProducts}
            initialDetail={initialProductDetail}
            productSku={productParam}
            activeTab={tabParam}
            displayName={me.displayName}
            canCreateProduct={canCreateProduct}
          />
        )}

        {!deptTaskSection && !toolParam && !boardView && dept && !campaignsMode && !productsMode && (
          <p className="internal-empty personal-hub-hint">{deptText(dept, t, 'description')}</p>
        )}

        {deptTaskSection && view === 'list' && (
          <InternalListView
            tasks={listTaskItems}
            onTaskClick={personalHomeSection ? handleAssignedTaskClick : setPanelTask}
            showTaskOrigin={personalHomeSection}
          />
        )}

        {deptTaskSection && !personalHomeSection && view === 'board' && (
          <InternalBoard
            tasks={taskItems}
            onTaskClick={setPanelTask}
            onStatusChange={handleStatusChange}
          />
        )}

        {boardTaskSection && boardCview === 'board' && (
          <InternalBoard
            tasks={taskItems}
            onTaskClick={setPanelTask}
            onStatusChange={handleStatusChange}
            statusColumns={boardStatusCols}
            board={resolvedBoard}
          />
        )}

        {boardTaskSection && boardCview === 'list' && (
          <InternalListView tasks={taskItems} onTaskClick={setPanelTask} statusColumns={boardStatusCols} />
        )}

        {flowTaskSection && flowCview === 'flow' && (
          <CampaignFlowCanvas
            campaign={resolvedCampaign}
            tasks={workspaceItems}
            boards={resolvedCampaign?.boards || []}
            flowDataVersion={flowDataVersion}
            onTaskClick={setPanelTask}
            onKanbanClick={boardId =>
              navigateToBoardOrigin(router, boardId, resolvedCampaign?.boards || [], {
                initiative: initiativeFromCampaign(resolvedCampaign),
              })
            }
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
            flowData={resolvedCampaign?.flow_data}
          />
        )}

        {flowTaskSection && flowCview === 'list' && (
          <InternalListView
            tasks={workspaceItems}
            onTaskClick={setPanelTask}
            flowData={resolvedCampaign?.flow_data}
          />
        )}
      </main>

      {panelTask && !outreachToolView && (
        <TaskPanel
          task={panelTask}
          onClose={closeTaskPanel}
          onSave={handleSave}
          onDelete={
            panelTask && actor && canDeleteTask(actor, panelTask)
              ? handleDelete
              : undefined
          }
          onPostComment={postComment}
          onWorkflowAction={handleWorkflowAction}
          postingComment={postingComment}
          workflowBusy={workflowBusy}
          displayName={me.displayName}
          lockDepartmentId={departmentId !== 'all' && !campaignsMode ? departmentId : null}
          lockBoard={lockBoard || lockFlow}
          statusColumns={boardStatusCols || flowStatusCols}
          boardCustomProperties={resolvedBoard?.custom_properties || []}
          onManageBoardFields={
            canEditBoardFields && resolvedBoard?.id
              ? () => setStatusEditorOpen(true)
              : undefined
          }
          teamMembers={teamMembers}
          lockAssigneeToSelf={personalMode}
          saving={saving}
        />
      )}

      {confirmDialog}
      <KanbanCreateModal
        open={kanbanCreateOpen}
        title={t('hub.internal.addKanbanNode')}
        showDepartmentPicker
        defaultDepartment={departmentId !== 'all' && departmentId !== CAMPAIGNS_ID ? departmentId : 'marketing'}
        busy={saving}
        existingBoards={kanbansNotOnFlow}
        loadingExisting={kanbanPickerLoading}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setKanbanCreateOpen(false)}
        onSubmit={handleConfirmCampaignKanban}
        onSelectExisting={handleAddExistingKanban}
      />
      {toastStack}
    </HubLayout>
  );
}
