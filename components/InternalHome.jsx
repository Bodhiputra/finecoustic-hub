'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import InternalCalendarWorkspace from '@/components/internal/InternalCalendarWorkspace';
import InternalScheduleFilters from '@/components/internal/InternalScheduleFilters';
import InternalSidebar from '@/components/internal/InternalSidebar';
import CampaignsWorkspace from '@/components/internal/CampaignsWorkspace';
import FinecousticAboutPage from '@/components/wiki/FinecousticAboutPage';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useHubPermissions } from '@/hooks/useHubPermissions';
import { useInternalTasks } from '@/hooks/useInternalTasks';
import { useTaskDeepLink } from '@/hooks/useTaskDeepLink';
import { useToast } from '@/hooks/useToast';
import { HOME_TAB, homeTabFromSearchParams, homeTabToUrl } from '@/lib/home-tabs';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { signalHubNotificationsRefresh } from '@/lib/hub-notifications-ui';
import {
  canCreateTask,
  isHubAdmin,
} from '@/lib/hub-permissions';
import { departmentIdsVisibleToUser } from '@/lib/hub-departments';
import {
  MASTER_CALENDAR_KIND_FILTERS,
  ALL_DEPARTMENTS_ID,
  DEPARTMENT_IDS,
  calendarItemMatchesDepartmentFilter,
  calendarItemMatchesKindFilter,
  newTaskDraft,
} from '@/lib/internal';

const TaskPanel = dynamic(() => import('@/components/internal/TaskPanel'), { ssr: false });

const MASTER_KINDS = MASTER_CALENDAR_KIND_FILTERS;

export default function InternalHome({
  authEnabled,
  initialProfile = null,
  initialTasks = [],
  initialTasksFilterKey = null,
  initialTeamMembers = null,
  initialCampaigns = null,
  initialWikiPages = null,
  displayName = '',
}) {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [homeTab, setHomeTab] = useState(() => homeTabFromSearchParams(searchParams));
  const [wikiPageId, setWikiPageId] = useState(() => searchParams.get('page') || '');
  const [campaignFlowId, setCampaignFlowId] = useState(() => searchParams.get('flow') || '');
  const [flowTasksRefreshKey, setFlowTasksRefreshKey] = useState(0);
  const [savedFlowTask, setSavedFlowTask] = useState(null);
  const wikiView = homeTab === HOME_TAB.WIKI;
  const campaignsView = homeTab === HOME_TAB.CAMPAIGNS;
  const scheduleView = homeTab === HOME_TAB.SCHEDULE;
  const { requestConfirm, confirmDialog } = useConfirm();
  const { toast, toastStack } = useToast();
  const { profile, permissions, loading: permissionsLoading, canDeleteTaskFor, actor } = useHubPermissions(initialProfile);
  const canCreate = useMemo(
    () => Boolean(actor && isHubAdmin(actor) && canCreateTask(actor)),
    [actor]
  );
  const isAdmin = profile.hubUser?.isAdmin ?? false;
  const accessResolved = Boolean(profile.hubUser) && !permissionsLoading;
  const allowedDepartmentIds = useMemo(
    () =>
      departmentIdsVisibleToUser(
        {
          isAdmin,
          departmentAccess: permissions?.departmentAccess,
          accessResolved,
        },
        DEPARTMENT_IDS
      ),
    [permissions, isAdmin, accessResolved]
  );
  const { tasks, refresh, mergeTask, removeTask } = useInternalTasks({
    initialTasks,
    initialTasksFilterKey,
    enabled: homeTab === HOME_TAB.SCHEDULE,
  });
  const [panelTask, setPanelTask] = useState(null);
  const { closePanel: closeTaskPanel } = useTaskDeepLink({
    tasks,
    panelTask,
    setPanelTask,
  });
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [teamMembers, setTeamMembers] = useState(() => initialTeamMembers || []);
  const displayNameResolved = profile.displayName || displayName;

  const setHomeTabClient = useCallback((tab, { pageId = '', flowId = '' } = {}) => {
    setHomeTab(tab);
    setWikiPageId(tab === HOME_TAB.WIKI ? pageId : '');
    setCampaignFlowId(tab === HOME_TAB.CAMPAIGNS ? flowId : '');
    if (typeof window === 'undefined') return;
    window.history.replaceState(window.history.state, '', homeTabToUrl(tab, { pageId, flowId }));
  }, []);

  const openCampaignFlow = useCallback((flowId) => {
    setHomeTabClient(HOME_TAB.CAMPAIGNS, { flowId });
  }, [setHomeTabClient]);

  const closeCampaignFlow = useCallback(() => {
    setHomeTabClient(HOME_TAB.CAMPAIGNS, { flowId: '' });
  }, [setHomeTabClient]);

  const openCampaignFlowNew = useCallback((kind = 'task') => {
    if (!campaignFlowId) return;
    setPanelTask(newTaskDraft({
      kind,
      department: 'operations',
      visibility: 'team',
      status: 'todo',
      campaign_id: campaignFlowId,
      board_id: null,
    }));
  }, [campaignFlowId]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setHomeTab(homeTabFromSearchParams(params));
      setWikiPageId(params.get('page') || '');
      setCampaignFlowId(params.get('flow') || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!accessResolved) return;
    if (isAdmin) {
      setActiveDepartments(new Set(DEPARTMENT_IDS));
      return;
    }
    const allowed = departmentIdsVisibleToUser(
      {
        isAdmin,
        departmentAccess: permissions?.departmentAccess,
        accessResolved: true,
      },
      DEPARTMENT_IDS
    );
    setActiveDepartments(new Set(allowed));
  }, [permissions, isAdmin, accessResolved]);

  useEffect(() => {
    if (initialTeamMembers !== null && initialTeamMembers !== undefined) return;
    fetch(API_V1.hubTeamMembers, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const data = unwrapData(body, 'members');
        const members = Array.isArray(data?.members) ? data.members : Array.isArray(data) ? data : [];
        if (members.length) setTeamMembers(members);
      })
      .catch(() => {});
  }, [initialTeamMembers]);

  const [focusDay, setFocusDay] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const scheduleItems = useMemo(
    () => tasks.filter(t => t.status !== 'archived'),
    [tasks]
  );

  const [activeKindFilters, setActiveKindFilters] = useState(() => new Set(MASTER_KINDS));
  const [activeDepartments, setActiveDepartments] = useState(() => new Set());

  function toggleKindFilter(id) {
    setActiveKindFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDepartmentFilter(id) {
    setActiveDepartments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredScheduleItems = useMemo(
    () =>
      scheduleItems.filter(item => {
        if (!calendarItemMatchesDepartmentFilter(item, activeDepartments)) return false;
        if (item.kind === 'task') return activeKindFilters.has('tasks');
        if (item.kind === 'milestone' || item.kind === 'event') return activeKindFilters.has('milestones');
        if (item.kind === 'meeting') return activeKindFilters.has('meetings');
        return false;
      }),
    [scheduleItems, activeKindFilters, activeDepartments]
  );

  const calendarItemFilter = useMemo(
    () => item =>
      calendarItemMatchesKindFilter(item, activeKindFilters) &&
      calendarItemMatchesDepartmentFilter(item, activeDepartments),
    [activeKindFilters, activeDepartments]
  );

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  function openNewMeeting(startDate = null) {
    setPanelTask(newTaskDraft({
      kind: 'meeting',
      department: ALL_DEPARTMENTS_ID,
      visibility: 'team',
      status: 'todo',
      meeting_scope: 'all',
      planned_for: startDate,
      deadline: startDate,
    }));
  }

  function openNewMilestone(startDate = null) {
    setPanelTask(newTaskDraft({
      kind: 'milestone',
      department: ALL_DEPARTMENTS_ID,
      visibility: 'team',
      status: 'todo',
      planned_for: startDate,
      deadline: startDate,
    }));
  }

  async function handleSaveItem(draft) {
    setSaving(true);
    try {
      const isNew = !draft.id || draft._draft;
      const url = isNew ? API_V1.internalTasks : API_V1.internalTask(draft.id);
      const method = isNew ? 'POST' : 'PATCH';
      const body = { ...draft };
      delete body._draft;
      if (Array.isArray(body.subtasks)) {
        body.subtasks = body.subtasks.filter(s => s.title?.trim());
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const bodyJson = await res.json();
        const data = unwrapData(bodyJson, 'task');
        const updated = data?.task || data;
        closeTaskPanel();
        if (homeTab === HOME_TAB.SCHEDULE) {
          if (updated?.id) mergeTask(updated);
          else await refresh();
        }
        if (homeTab === HOME_TAB.CAMPAIGNS && campaignFlowId) {
          if (isNew && updated?.id) setSavedFlowTask(updated);
          setFlowTasksRefreshKey(key => key + 1);
        }
        signalHubNotificationsRefresh();
      }
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

  async function handleDelete(id) {
    const ok = await requestConfirm({
      title: t('hub.internal.taskPanel.delete'),
      message: t('hub.internal.deleteConfirm'),
      confirmLabel: t('hub.internal.taskPanel.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(API_V1.internalTask(id), { method: 'DELETE', credentials: 'same-origin' });
      if (res.ok) {
        closeTaskPanel();
        if (homeTab === HOME_TAB.SCHEDULE) removeTask(id);
        if (homeTab === HOME_TAB.CAMPAIGNS && campaignFlowId) {
          setFlowTasksRefreshKey(key => key + 1);
        }
      }
    } finally {
      setSaving(false);
    }
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
      if (homeTab === HOME_TAB.SCHEDULE && updated?.id) mergeTask(updated);
      if (homeTab === HOME_TAB.CAMPAIGNS && campaignFlowId) {
        setFlowTasksRefreshKey(key => key + 1);
      }
    } finally {
      setWorkflowBusy(false);
    }
  }

  return (
    <HubLayout
      className="internal-home-layout"
      topNavTitle={
        wikiView
          ? t('hub.internal.allAboutFinecoustic')
          : campaignsView || scheduleView
            ? ''
            : t('hub.internal.scheduleDashboard')
      }
      authEnabled={authEnabled}
      displayName={displayNameResolved}
      onLogout={handleLogout}
      sidebarLabel={t('hub.internal.title')}
      sidebar={
        <InternalSidebar
          mode="home"
          initialHubUser={profile.hubUser}
          initialWikiPages={initialWikiPages}
          accountDisplayName={displayNameResolved}
          homeTab={homeTab}
          wikiPageId={wikiPageId}
          onHomeTabChange={setHomeTabClient}
        />
      }
    >
      <main className="hub-main internal-main">
        <section
          className="internal-team-schedule"
          hidden={!scheduleView}
          aria-hidden={!scheduleView}
        >
              <div className="internal-team-schedule-head">
                <div>
                  <h2>{t('hub.internal.teamSchedule')}</h2>
                </div>
                <div className="internal-team-schedule-actions">
                  <InternalScheduleFilters
                    activeFilters={activeKindFilters}
                    onToggleType={toggleKindFilter}
                    kinds={MASTER_KINDS}
                    activeDepartments={activeDepartments}
                    onToggleDepartment={toggleDepartmentFilter}
                    showDepartments
                    departmentIds={allowedDepartmentIds}
                  />
                  {canCreate ? (
                  <>
                  <button
                    type="button"
                    className="appdev-btn-ghost"
                    onClick={() => openNewMeeting()}
                    disabled={saving}
                  >
                    <Icon name="users" size={16} />
                    {t('hub.internal.addMeeting')}
                  </button>
                  <button
                    type="button"
                    className="appdev-btn-primary internal-add-btn"
                    onClick={() => openNewMilestone()}
                    disabled={saving}
                  >
                    <Icon name="plus" size={16} />
                    {t('hub.internal.addMilestone')}
                  </button>
                  </>
                  ) : null}
                </div>
              </div>
              <InternalCalendarWorkspace
                tasks={filteredScheduleItems}
                holidaysByDate={{}}
                showHolidays={false}
                countries={[]}
                cursor={cursor}
                onCursorChange={setCursor}
                onDayClick={date => (canCreate ? openNewMilestone(date) : undefined)}
                onTaskClick={setPanelTask}
                calendarItemFilter={calendarItemFilter}
                showHolidayControls={false}
                showToolbar={false}
                showRail
                focusDay={focusDay}
                onFocusDay={setFocusDay}
                compact
              />
        </section>
        <div hidden={!campaignsView} aria-hidden={!campaignsView}>
          <CampaignsWorkspace
            initialProfile={profile}
            initialCampaigns={initialCampaigns}
            activeFlowId={campaignFlowId}
            onOpenFlow={openCampaignFlow}
            onCloseFlow={closeCampaignFlow}
            onOpenNewTask={openCampaignFlowNew}
            onTaskClick={setPanelTask}
            savedFlowTask={savedFlowTask}
            onSavedFlowTaskHandled={() => setSavedFlowTask(null)}
            tasksRefreshKey={flowTasksRefreshKey}
          />
        </div>
        <div hidden={!wikiView} aria-hidden={!wikiView}>
          <FinecousticAboutPage
            pageId={wikiPageId}
            initialPages={initialWikiPages}
          />
        </div>
      </main>

      {panelTask && (
        <TaskPanel
          task={panelTask}
          onClose={closeTaskPanel}
          onSave={handleSaveItem}
          onDelete={
            panelTask && canDeleteTaskFor(panelTask) ? handleDelete : undefined
          }
          onWorkflowAction={handleWorkflowAction}
          onPostComment={postComment}
          workflowBusy={workflowBusy}
          postingComment={postingComment}
          displayName={displayNameResolved}
          teamMembers={teamMembers}
          saving={saving}
        />
      )}

      {confirmDialog}
      {toastStack}
    </HubLayout>
  );
}
