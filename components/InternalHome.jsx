'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import TaskPanel from '@/components/internal/TaskPanel';
import InternalCalendarWorkspace from '@/components/internal/InternalCalendarWorkspace';
import InternalScheduleFilters from '@/components/internal/InternalScheduleFilters';
import InternalSidebar from '@/components/internal/InternalSidebar';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useInternalTasks } from '@/hooks/useInternalTasks';
import { API_V1 } from '@/lib/api/routes';
import {
  MASTER_CALENDAR_KIND_FILTERS,
  ALL_DEPARTMENTS_ID,
  DEPARTMENT_IDS,
  calendarItemMatchesDepartmentFilter,
  calendarItemMatchesKindFilter,
  newTaskDraft,
} from '@/lib/internal';

const MASTER_KINDS = MASTER_CALENDAR_KIND_FILTERS;

export default function InternalHome({ authEnabled, initialTasks = [], displayName = '' }) {
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const { tasks, refresh } = useInternalTasks({ initialTasks });
  const [panelTask, setPanelTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState({ displayName });

  useEffect(() => {
    if (displayName) {
      setMe(prev => ({ ...prev, displayName }));
      return;
    }
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.displayName) setMe({ displayName: data.displayName, hubUser: data.hubUser });
      })
      .catch(() => {});
  }, [displayName]);

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
  const [activeDepartments, setActiveDepartments] = useState(() => new Set(DEPARTMENT_IDS));

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
        setPanelTask(null);
        await refresh();
      }
    } finally {
      setSaving(false);
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
        setPanelTask(null);
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <HubLayout
      className="internal-home-layout"
      topNavTitle={t('hub.internal.scheduleDashboard')}
      authEnabled={authEnabled}
      displayName={me.displayName || displayName}
      onLogout={handleLogout}
      sidebarLabel={t('hub.internal.title')}
      sidebar={
        <InternalSidebar mode="home" />
      }
    >
      <main className="hub-main internal-main">
        <section className="internal-team-schedule">
          <div className="internal-team-schedule-head">
            <div>
              <h2>{t('hub.internal.teamSchedule')}</h2>
              <p className="internal-team-schedule-desc">{t('hub.internal.teamScheduleHint')}</p>
            </div>
            <div className="internal-team-schedule-actions">
              <InternalScheduleFilters
                activeFilters={activeKindFilters}
                onToggleType={toggleKindFilter}
                kinds={MASTER_KINDS}
                activeDepartments={activeDepartments}
                onToggleDepartment={toggleDepartmentFilter}
                showDepartments
              />
              <button
                type="button"
                className="appdev-btn-primary internal-add-btn"
                onClick={() => openNewMilestone()}
                disabled={saving}
              >
                <Icon name="plus" size={16} />
                {t('hub.internal.addMilestone')}
              </button>
            </div>
          </div>
          <InternalCalendarWorkspace
            tasks={filteredScheduleItems}
            holidaysByDate={{}}
            showHolidays={false}
            countries={[]}
            cursor={cursor}
            onCursorChange={setCursor}
            onDayClick={date => openNewMilestone(date)}
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
      </main>

      {panelTask && (
        <TaskPanel
          task={panelTask}
          onClose={() => setPanelTask(null)}
          onSave={handleSaveItem}
          onDelete={handleDelete}
          saving={saving}
        />
      )}

      {confirmDialog}
    </HubLayout>
  );
}
