'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import TaskPanel from '@/components/warzone/TaskPanel';
import WarzoneCalendarWorkspace from '@/components/warzone/WarzoneCalendarWorkspace';
import WarzoneScheduleFilters from '@/components/warzone/WarzoneScheduleFilters';
import WarzoneSidebar from '@/components/warzone/WarzoneSidebar';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import { useWarzoneTasks } from '@/hooks/useWarzoneTasks';
import { API_V1 } from '@/lib/api/routes';
import {
  calendarItemMatchesDepartmentFilter,
  calendarItemMatchesKindFilter,
  DEPARTMENT_IDS,
  MASTER_CALENDAR_KIND_FILTERS,
  newTaskDraft,
} from '@/lib/warzone';

const MASTER_KINDS = MASTER_CALENDAR_KIND_FILTERS;

export default function WarzoneHome({ authEnabled, initialTasks = [], displayName = '' }) {
  const { t } = useLocale();
  const { tasks, refresh } = useWarzoneTasks({ initialTasks });
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

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [focusDay, setFocusDay] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [calendarFilters, setCalendarFilters] = useState(() => new Set(MASTER_KINDS));
  const [departmentFilters, setDepartmentFilters] = useState(() => new Set(DEPARTMENT_IDS));

  const scheduleItems = useMemo(
    () => tasks.filter(t => t.status !== 'archived'),
    [tasks]
  );

  const calendarTasks = useMemo(
    () => scheduleItems.filter(item => calendarItemMatchesDepartmentFilter(item, departmentFilters)),
    [scheduleItems, departmentFilters]
  );

  const calendarItemFilter = useCallback(
    item => calendarItemMatchesKindFilter(item, calendarFilters)
      && calendarItemMatchesDepartmentFilter(item, departmentFilters),
    [calendarFilters, departmentFilters]
  );

  function toggleCalendarFilter(id) {
    setCalendarFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleDepartmentFilter(id) {
    setDepartmentFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const stats = useMemo(() => {
    const active = tasks.filter(t => t.kind === 'task' && t.status !== 'done' && t.status !== 'archived');
    return {
      today: active.filter(t => t.deadline === today || t.planned_for === today).length,
      overdue: active.filter(t => t.deadline && t.deadline < today).length,
      inProgress: active.filter(t => t.status === 'in_progress').length,
      bank: active.filter(t => !t.deadline && !t.planned_for).length,
    };
  }, [tasks, today]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  function openNewMilestone(startDate = null) {
    setPanelTask(newTaskDraft({
      kind: 'milestone',
      department: 'operations',
      visibility: 'team',
      status: 'todo',
      deadline: startDate,
    }));
  }

  async function handleSaveItem(draft) {
    setSaving(true);
    try {
      const isNew = !draft.id || draft._draft;
      const url = isNew ? API_V1.warzoneTasks : API_V1.warzoneTask(draft.id);
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

  return (
    <HubLayout
      className="warzone-home-layout"
      topNavTitle={t('hub.warzone.title')}
      authEnabled={authEnabled}
      displayName={me.displayName || displayName}
      onLogout={handleLogout}
      sidebarLabel={t('hub.warzone.title')}
      sidebar={
        <WarzoneSidebar mode="home" />
      }
    >
      <main className="hub-main warzone-main">
        <section className="warzone-home-overview">
          <div className="warzone-home-overview-head">
            <div>
              <h2>{t('hub.warzone.workOverview')}</h2>
              <p className="warzone-home-overview-desc">{t('hub.warzone.workOverviewHint')}</p>
            </div>
          </div>
          <div className="warzone-kpi-row">
            <Link href="/tasks?view=today" className="warzone-kpi">
              <span className="warzone-kpi-val">{stats.today}</span>
              <span>{t('hub.warzone.today')}</span>
            </Link>
            <Link href="/tasks?view=overdue" className="warzone-kpi is-warn">
              <span className="warzone-kpi-val">{stats.overdue}</span>
              <span>{t('hub.warzone.overdue')}</span>
            </Link>
            <Link href="/tasks?view=in_progress" className="warzone-kpi">
              <span className="warzone-kpi-val">{stats.inProgress}</span>
              <span>{t('hub.warzone.inProgress')}</span>
            </Link>
            <Link href="/tasks?view=bank" className="warzone-kpi">
              <span className="warzone-kpi-val">{stats.bank}</span>
              <span>{t('hub.warzone.todoBank')}</span>
            </Link>
          </div>
        </section>

        <section className="warzone-team-schedule">
          <div className="warzone-team-schedule-head">
            <div>
              <h2>{t('hub.warzone.teamSchedule')}</h2>
              <p className="warzone-team-schedule-desc">{t('hub.warzone.teamScheduleHint')}</p>
            </div>
            <div className="warzone-team-schedule-actions">
              <button
                type="button"
                className="appdev-btn-primary warzone-add-btn"
                onClick={() => openNewMilestone()}
                disabled={saving}
              >
                <Icon name="plus" size={16} />
                {t('hub.warzone.addMilestone')}
              </button>
              <WarzoneScheduleFilters
                activeFilters={calendarFilters}
                onToggleType={toggleCalendarFilter}
                kinds={MASTER_KINDS}
                showDepartments
                activeDepartments={departmentFilters}
                onToggleDepartment={toggleDepartmentFilter}
              />
            </div>
          </div>
          <WarzoneCalendarWorkspace
            tasks={calendarTasks}
            holidaysByDate={{}}
            showHolidays={false}
            countries={[]}
            cursor={cursor}
            onCursorChange={setCursor}
            onDayClick={date => openNewMilestone(date)}
            onTaskClick={setPanelTask}
            calendarItemFilter={calendarItemFilter}
            showHolidayControls={false}
            showToolbar
            legendKinds={MASTER_KINDS}
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
          saving={saving}
        />
      )}
    </HubLayout>
  );
}
