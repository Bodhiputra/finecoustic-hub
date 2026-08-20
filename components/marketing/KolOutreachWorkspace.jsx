'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import DataWorkspaceShell from '@/components/workspace/DataWorkspaceShell';
import KolOutreachBoardActions from '@/components/marketing/KolOutreachBoardActions';
import { useLocale } from '@/components/LocaleProvider';
import { useTaskDeepLink } from '@/hooks/useTaskDeepLink';
import { API_V1 } from '@/lib/api/routes';
import {
  KOL_BOARD_PROP,
  KOL_OUTREACH_BOARD_ID,
  defaultKolOutreachCustomProperties,
  defaultKolOutreachStatusColumns,
} from '@/lib/kol-outreach-shared';

const TaskPanel = dynamic(() => import('@/components/internal/TaskPanel'), { ssr: false });

const STATUS_IDS = defaultKolOutreachStatusColumns().map(col => col.id);

const STATUS_LABEL_KEYS = {
  not_started: 'hub.campaignKol.statusNotStarted',
  waiting_response: 'hub.campaignKol.statusWaitingResponse',
  no_reply: 'hub.campaignKol.statusNoReply',
  no_deal: 'hub.campaignKol.statusNoDeal',
  deal: 'hub.campaignKol.statusDeal',
};

function cell(value) {
  const text = String(value || '').trim();
  return text || '—';
}

export default function KolOutreachWorkspace({
  tasks = [],
  onTasksChanged,
  initialPoolRecords = [],
  canCreate = true,
  displayName = '',
  teamMembers = [],
}) {
  const { t } = useLocale();
  const [section, setSection] = useState('all');
  const [query, setQuery] = useState('');
  const [panelTask, setPanelTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const { closePanel: closeTaskPanel } = useTaskDeepLink({ tasks, panelTask, setPanelTask });

  const statusColumns = useMemo(() => defaultKolOutreachStatusColumns(), []);
  const boardCustomProperties = useMemo(() => defaultKolOutreachCustomProperties(), []);

  const counts = useMemo(() => {
    const map = { all: tasks.length };
    for (const id of STATUS_IDS) {
      map[id] = tasks.filter(task => task.status === id).length;
    }
    return map;
  }, [tasks]);

  const filtered = useMemo(() => {
    let rows = tasks;
    if (section !== 'all') {
      rows = rows.filter(task => task.status === section);
    }
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(task => {
      const cv = task.custom_values || {};
      const hay = [
        task.title,
        task.notes,
        cv[KOL_BOARD_PROP.dealType],
        cv[KOL_BOARD_PROP.socials],
        cv[KOL_BOARD_PROP.trackingLink],
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, section, query]);

  function statusLabel(statusId) {
    const key = STATUS_LABEL_KEYS[statusId];
    return key ? t(key) : statusId;
  }

  const tabs = useMemo(
    () => [
      { id: 'all', label: t('hub.campaignKol.filterAll'), count: counts.all },
      ...STATUS_IDS.map(id => ({
        id,
        label: statusLabel(id),
        count: counts[id] ?? 0,
      })),
    ],
    [counts, t]
  );

  async function handleSave(draft) {
    setSaving(true);
    try {
      const isNew = !draft.id || draft._draft;
      const res = await fetch(isNew ? API_V1.internalTasks : API_V1.internalTask(draft.id), {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...draft, _draft: undefined }),
      });
      if (!res.ok) return;
      closeTaskPanel();
      await onTasksChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DataWorkspaceShell
        className="kol-outreach-workspace"
        title={t('hub.campaignKol.title')}
        subtitle={t('hub.campaignKol.subtitle')}
        meta={t('hub.campaignKol.humanHint')}
        actions={(
          <KolOutreachBoardActions
            tasks={tasks}
            initialPoolRecords={initialPoolRecords}
            onTasksChanged={onTasksChanged}
            canCreate={canCreate}
          />
        )}
        tabs={tabs}
        activeTab={section}
        onTabChange={setSection}
        tabsAriaLabel={t('hub.campaignKol.colStatus')}
        searchQuery={query}
        onSearchChange={setQuery}
        searchPlaceholder={t('hub.kol.searchPlaceholder')}
        resultCount={filtered.length}
        resultCountLabel={t('hub.kol.showing')}
        empty={filtered.length === 0 ? t('hub.campaignKol.empty') : null}
      >
        {filtered.length > 0 ? (
          <div className="kol-pool-table-wrap h-scroll">
            <table className="kol-pool-table kol-outreach-table">
              <thead>
                <tr>
                  <th>{t('hub.kol.colChannel')}</th>
                  <th>{t('hub.campaignKol.colStatus')}</th>
                  <th>{t('hub.campaignKol.colDealType')}</th>
                  <th>{t('hub.campaignKol.colApproachDate')}</th>
                  <th>{t('hub.campaignKol.colSocials')}</th>
                  <th>{t('hub.campaignKol.colShipping')}</th>
                  <th>{t('hub.campaignKol.colArrival')}</th>
                  <th>{t('hub.campaignKol.colPublish')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => {
                  const cv = task.custom_values || {};
                  return (
                    <tr
                      key={task.id}
                      className="kol-pool-row-click"
                      onClick={() => setPanelTask(task)}
                    >
                      <td className="kol-pool-channel">{task.title || '—'}</td>
                      <td>
                        <span className={`kol-outreach-status is-${task.status}`}>
                          {statusLabel(task.status)}
                        </span>
                      </td>
                      <td>{cell(cv[KOL_BOARD_PROP.dealType])}</td>
                      <td>{cell(cv[KOL_BOARD_PROP.approachDate])}</td>
                      <td className="kol-pool-desc-cell">{cell(cv[KOL_BOARD_PROP.socials])}</td>
                      <td>{cell(cv[KOL_BOARD_PROP.shippingDate])}</td>
                      <td>{cell(cv[KOL_BOARD_PROP.arrivalDate])}</td>
                      <td>{cell(cv[KOL_BOARD_PROP.publishStatus])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </DataWorkspaceShell>

      {panelTask ? (
        <TaskPanel
          task={panelTask}
          onClose={closeTaskPanel}
          onSave={handleSave}
          displayName={displayName}
          lockDepartmentId="marketing"
          lockBoard={{ board_id: KOL_OUTREACH_BOARD_ID, campaign_id: null }}
          statusColumns={statusColumns}
          boardCustomProperties={boardCustomProperties}
          boardId={KOL_OUTREACH_BOARD_ID}
          teamMembers={teamMembers}
          saving={saving}
        />
      ) : null}
    </>
  );
}
