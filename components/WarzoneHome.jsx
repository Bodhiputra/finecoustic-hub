'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import TaskPanel from '@/components/warzone/TaskPanel';
import WarzoneCalendarWorkspace from '@/components/warzone/WarzoneCalendarWorkspace';
import WarzoneSidebar from '@/components/warzone/WarzoneSidebar';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';
import { useWarzoneTasks } from '@/hooks/useWarzoneTasks';
import { API_V1 } from '@/lib/api/routes';
import { MASTER_CALENDAR_KIND_FILTERS, newTaskDraft } from '@/lib/warzone';

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

  const [focusDay, setFocusDay] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const scheduleItems = useMemo(
    () => tasks.filter(t => t.status !== 'archived'),
    [tasks]
  );

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
      topNavTitle={t('hub.warzone.scheduleDashboard')}
      authEnabled={authEnabled}
      displayName={me.displayName || displayName}
      onLogout={handleLogout}
      sidebarLabel={t('hub.warzone.title')}
      sidebar={
        <WarzoneSidebar mode="home" />
      }
    >
      <main className="hub-main warzone-main">
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
            </div>
          </div>
          <WarzoneCalendarWorkspace
            tasks={scheduleItems}
            holidaysByDate={{}}
            showHolidays={false}
            countries={[]}
            cursor={cursor}
            onCursorChange={setCursor}
            onDayClick={date => openNewMilestone(date)}
            onTaskClick={setPanelTask}
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
