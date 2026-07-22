'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import TaskPanel from '@/components/warzone/TaskPanel';
import WarzoneBoard from '@/components/warzone/WarzoneBoard';
import WarzoneListView from '@/components/warzone/WarzoneListView';
import WarzoneTaskFilters from '@/components/warzone/WarzoneTaskFilters';
import WarzoneSidebar from '@/components/warzone/WarzoneSidebar';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import { useWarzoneTasks } from '@/hooks/useWarzoneTasks';
import { API_V1 } from '@/lib/api/routes';
import {
  collectPeopleFromTasks,
  dataLinkLabel,
  deptText,
  getDepartment,
  getDepartmentPath,
  newTaskDraft,
  parsePeopleParam,
  taskMatchesPeopleFilter,
  warzoneTasksUrl,
} from '@/lib/warzone';
import { MarketingHubContent } from '@/components/MarketingHub';
import { OpsHubContent } from '@/components/OpsHub';

const BUCKET_VIEWS = ['today', 'overdue', 'in_progress', 'bank', 'milestones'];
const TASK_VIEWS = ['list', 'board'];

export default function WarzoneDepartment({
  departmentId,
  authEnabled,
  initialBucket = '',
  initialTool = '',
  initialTasks = null,
  opsData = null,
  marketingRows = [],
}) {
  const dept = getDepartment(departmentId);
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view') || initialBucket || '';
  const toolParam = searchParams.get('tool') || initialTool || '';

  const bucket = BUCKET_VIEWS.includes(viewParam) ? viewParam : (searchParams.get('bucket') || '');
  const view = BUCKET_VIEWS.includes(viewParam)
    ? 'list'
    : (TASK_VIEWS.includes(viewParam) ? viewParam : 'board');
  const activePeople = useMemo(
    () => parsePeopleParam(searchParams.get('people')),
    [searchParams]
  );

  const { tasks, refresh } = useWarzoneTasks({
    departmentId,
    bucket,
    initialTasks,
  });

  const [panelTask, setPanelTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState({ displayName: '' });

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.displayName) setMe({ displayName: data.displayName, hubUser: data.hubUser });
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (departmentId === 'all') return tasks;
    return tasks.filter(task => task.department === departmentId);
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
      const res = await fetch(isNew ? API_V1.warzoneTasks : API_V1.warzoneTask(draft.id), {
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
    const res = await fetch(API_V1.warzoneTask(task.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    });
    if (res.ok) await refresh();
  }

  async function handleDelete(id) {
    if (!confirm(t('hub.warzone.deleteConfirm'))) return;
    await fetch(API_V1.warzoneTask(id), { method: 'DELETE', credentials: 'same-origin' });
    setPanelTask(null);
    await refresh();
  }

  function openNew() {
    setPanelTask(newTaskDraft({
      department: departmentId === 'all' ? 'operations' : departmentId,
      visibility: 'team',
      status: 'todo',
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
    return warzoneTasksUrl(deptBase, { view: viewId, people: activePeople });
  }

  function isTaskViewActive(viewId) {
    if (toolParam) return false;
    if (BUCKET_VIEWS.includes(viewId)) return viewParam === viewId;
    return viewParam === viewId || (!viewParam && viewId === 'board');
  }

  function isToolActive(toolId) {
    return toolParam === toolId;
  }

  const taskViews = [
    { id: 'board', label: t('hub.warzone.viewBoard'), icon: 'kanban' },
    { id: 'list', label: t('hub.warzone.viewList'), icon: 'layout' },
  ];

  const taskSection = !toolParam;

  const topNavTitle = departmentId === 'all'
    ? t('hub.warzone.allTasks')
    : (dept ? deptText(dept, t, 'label') : '');
  const activeToolLink = toolParam && dept?.dataLinks?.find(link => link.id === toolParam);
  const topNavSubtitle = activeToolLink ? dataLinkLabel(activeToolLink, t) : '';

  return (
    <HubLayout
      className="warzone-dept-layout"
      topNavTitle={topNavTitle}
      topNavSubtitle={topNavSubtitle}
      authEnabled={authEnabled}
      displayName={me.displayName}
      onLogout={handleLogout}
      sidebarClassName="warzone-dept-sidebar"
      sidebarLabel={departmentId === 'all' ? t('hub.warzone.allTasks') : (dept ? t(dept.labelKey) : '')}
      sidebar={
        <WarzoneSidebar
          mode={sidebarMode}
          departmentId={departmentId}
          isToolActive={isToolActive}
          toolParam={toolParam}
        />
      }
    >
      <main className="main warzone-dept-main">
        {taskSection && (
          <div className="warzone-dept-toolbar">
            <div className="warzone-dept-view-tabs" role="toolbar" aria-label={t('hub.warzone.sectionTasks')}>
              {taskViews.map(({ id, label, icon }) => (
                <Link
                  key={id}
                  href={viewHref(id)}
                  className={`warzone-dept-view-tab${isTaskViewActive(id) ? ' is-active' : ''}`}
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
                className="appdev-btn-primary warzone-add-btn"
                onClick={() => openNew()}
                disabled={saving}
              >
                <Icon name="plus" size={16} />
                {t('hub.warzone.addTaskIssue')}
              </button>
            )}
          </div>
        )}

        {taskSection && (
          <WarzoneTaskFilters
            deptBase={deptBase}
            activeView={BUCKET_VIEWS.includes(viewParam) ? viewParam : ''}
            taskView={view}
            activePeople={activePeople}
            people={peopleOptions}
          />
        )}

        {toolParam && departmentId === 'marketing' && (
          <MarketingHubContent view={toolParam} initialRows={marketingRows} />
        )}

        {toolParam && departmentId === 'operations' && opsData && (
          <OpsHubContent initialData={opsData} view={toolParam} />
        )}

        {taskSection && view === 'list' && (
          <WarzoneListView tasks={taskItems} onTaskClick={setPanelTask} />
        )}

        {taskSection && view === 'board' && (
          <WarzoneBoard
            tasks={taskItems}
            onTaskClick={setPanelTask}
            onStatusChange={handleStatusChange}
          />
        )}
      </main>

      {panelTask && (
        <TaskPanel
          task={panelTask}
          onClose={() => setPanelTask(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          saving={saving}
        />
      )}
    </HubLayout>
  );
}
