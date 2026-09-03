'use client';

import { useMemo, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import KolOutreachCard from '@/components/marketing/KolOutreachCard';
import KolWeibinColumnActions from '@/components/marketing/KolWeibinColumnActions';
import {
  allowedKolTransition,
  defaultKolOutreachStatusColumns,
  isKolWeibinExportStatus,
  normalizeKolOutreachStatus,
  openKolWeibinExport,
} from '@/lib/kol-outreach-shared';
import { poolRecordForTask } from '@/lib/kol-outreach-utils';

const STATUS_LABEL_KEYS = {
  not_started: 'hub.campaignKol.statusNotStarted',
  waiting_response: 'hub.campaignKol.statusWaitingResponse',
  deal: 'hub.campaignKol.statusDeal',
  no_deal: 'hub.campaignKol.statusNoDeal',
  quality_control: 'hub.campaignKol.statusQualityControl',
  weibin: 'hub.campaignKol.statusWeibin',
  shipping: 'hub.campaignKol.statusShipping',
  arrived: 'hub.campaignKol.statusArrived',
  publish: 'hub.campaignKol.statusPublish',
};

export default function KolOutreachKanban({
  tasks,
  poolRecords = [],
  displayName = '',
  isManager = false,
  isAdmin = false,
  initiativeFilter = '',
  selectedIds = null,
  selectMode = false,
  selectedWeibinExportCount = 0,
  onEnterSelectMode,
  onExitSelectMode,
  onExportSelected,
  onToggleSelect,
  onStatusChange,
  onOpenCard,
  onMoreInfo,
  onFollowUp,
}) {
  const { t } = useLocale();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const columns = useMemo(() => defaultKolOutreachStatusColumns(), []);

  const weibinExportCount = useMemo(
    () => tasks.filter(task => isKolWeibinExportStatus(task.status)).length,
    [tasks]
  );

  function columnLabel(col) {
    const key = STATUS_LABEL_KEYS[col.id];
    return key ? t(key) : col.label;
  }

  function onDragStart(e, taskId) {
    setDragId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }

  function onDragOver(e, colId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverCol(colId);
  }

  function onDrop(e, colId) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const task = tasks.find(row => row.id === id);
    if (!task) return;
    const from = normalizeKolOutreachStatus(task.status);
    const to = normalizeKolOutreachStatus(colId);
    if (!allowedKolTransition(from, to)) return;
    onStatusChange?.(task, to);
  }

  function exportWeibinExcelAll() {
    openKolWeibinExport({ initiative: initiativeFilter });
  }

  return (
    <section
      className={`internal-board kol-outreach-kanban${onToggleSelect ? ' is-select-mode' : ''}`}
      aria-label={t('hub.campaignKol.kanbanLabel')}
    >
      <div className="internal-board-scroll h-scroll h-scroll--hint h-scroll--bleed" tabIndex={0}>
        <div className="internal-board-cols">
          {columns.map(col => {
            const colTasks = tasks.filter(task => normalizeKolOutreachStatus(task.status) === col.id);
            return (
              <div
                key={col.id}
                className={`internal-board-col kol-outreach-col is-${col.id}${overCol === col.id ? ' is-drop-target' : ''}`}
                onDragOver={e => onDragOver(e, col.id)}
                onDragLeave={() => setOverCol(current => (current === col.id ? null : current))}
                onDrop={e => onDrop(e, col.id)}
              >
                <header className="internal-board-col-head">
                  <span className={`internal-board-col-bar is-${col.id}`} aria-hidden="true" />
                  <h3>{columnLabel(col)}</h3>
                  <span className="internal-board-col-count">{colTasks.length}</span>
                  {col.id === 'weibin' ? (
                    <KolWeibinColumnActions
                      exportableCount={weibinExportCount}
                      selectMode={selectMode}
                      selectedExportCount={selectedWeibinExportCount}
                      onEnterSelectMode={onEnterSelectMode}
                      onExitSelectMode={onExitSelectMode}
                      onExportSelected={onExportSelected}
                      onExportAll={exportWeibinExcelAll}
                    />
                  ) : null}
                </header>
                <div className="internal-board-col-body">
                  {colTasks.length === 0 ? (
                    <p className="internal-board-col-empty">{t('hub.internal.boardEmptyColumn')}</p>
                  ) : null}
                  {colTasks.map(task => (
                    <KolOutreachCard
                      key={task.id}
                      task={task}
                      poolRecord={poolRecordForTask(task, poolRecords)}
                      displayName={displayName}
                      isManager={isManager}
                      isAdmin={isAdmin}
                      draggable
                      isDragging={dragId === task.id}
                      selected={selectedIds?.has(task.id)}
                      onToggleSelect={onToggleSelect}
                      onDragStart={e => onDragStart(e, task.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      onOpenCard={onOpenCard}
                      onMoreInfo={onMoreInfo}
                      onFollowUp={onFollowUp}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
