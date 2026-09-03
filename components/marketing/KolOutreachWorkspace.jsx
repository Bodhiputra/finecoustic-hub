'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DataWorkspaceShell from '@/components/workspace/DataWorkspaceShell';
import KolOutreachBoardActions from '@/components/marketing/KolOutreachBoardActions';
import KolOutreachKanban from '@/components/marketing/KolOutreachKanban';
import KolOutreachCardModal from '@/components/marketing/KolOutreachCardModal';
import KolOutreachMoreInfoModal from '@/components/marketing/KolOutreachMoreInfoModal';
import KolOutreachFollowUpModal from '@/components/marketing/KolOutreachFollowUpModal';
import KolOutreachTransitionModal from '@/components/marketing/KolOutreachTransitionModal';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import { useHubPermissions } from '@/hooks/useHubPermissions';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { signalHubNotificationsRefresh } from '@/lib/hub-notifications-ui';
import {
  KOL_APPROACH_DIRECTIONS,
  KOL_BOARD_PROP,
  KOL_DEAL_TYPES,
  KOL_INITIATIVES,
  defaultKolOutreachStatusColumns,
  formatKolOrderNumber,
  isKolWeibinExportStatus,
  kolOutreachBoardUrl,
  kolTransitionSteps,
  initiativeLabel,
  KOL_ORDER_NUMBER_EXTERNAL_FLOOR,
  latestKolOrderNumberSequence,
  normalizeApproachDirection,
  normalizeKolOutreachStatus,
  openKolWeibinExport,
  resolveKolInitiative,
  suggestNextKolOrderNumber,
  DEFAULT_KOL_INITIATIVE,
} from '@/lib/kol-outreach-shared';
import {
  appendProductsToPoolRecord,
  collectOutreachCountryOptions,
  collectOutreachPlatformOptions,
  existingOutreachKeys,
  filterOutreachTasks,
  poolRecordForTask,
  taskInitiative,
  taskPoolId,
} from '@/lib/kol-outreach-utils';
import { buildTeamAssigneeOptions } from '@/lib/internal';

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

export default function KolOutreachWorkspace({
  tasks = [],
  onTasksChanged,
  initialPoolRecords = [],
  canCreate = true,
  displayName = '',
  teamMembers = [],
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const { requestConfirm, confirmDialog } = useConfirm();
  const { canDeleteTaskFor, actor } = useHubPermissions();
  const searchParams = useSearchParams();
  const initiativeFromUrl = (searchParams.get('initiative') || '').trim().toLowerCase();

  const [view, setView] = useState('board');
  const [query, setQuery] = useState('');
  const [initiativeFilter, setInitiativeFilter] = useState(() => resolveKolInitiative(initiativeFromUrl));
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dealTypeFilter, setDealTypeFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [approachDirectionFilter, setApproachDirectionFilter] = useState('all');
  const [poolRecords, setPoolRecords] = useState(initialPoolRecords);
  const [cardTask, setCardTask] = useState(null);
  const [moreInfoTask, setMoreInfoTask] = useState(null);
  const [followUpTask, setFollowUpTask] = useState(null);
  const [transition, setTransition] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [selectMode, setSelectMode] = useState(false);

  useEffect(() => {
    setInitiativeFilter(resolveKolInitiative(initiativeFromUrl));
  }, [initiativeFromUrl]);

  useEffect(() => {
    if (typeof window === 'undefined' || initiativeFromUrl) return;
    window.history.replaceState(window.history.state, '', kolOutreachBoardUrl(DEFAULT_KOL_INITIATIVE));
  }, [initiativeFromUrl]);

  const selectInitiative = useCallback((id) => {
    const next = resolveKolInitiative(id);
    setInitiativeFilter(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', kolOutreachBoardUrl(next));
    }
  }, []);

  useEffect(() => {
    if (initialPoolRecords.length) {
      setPoolRecords(initialPoolRecords);
      return;
    }
    fetch(API_V1.marketingKolPool, { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        const data = unwrapData(body);
        const records = Array.isArray(data?.records) ? data.records : [];
        if (records.length) setPoolRecords(records);
      })
      .catch(() => {});
  }, [initialPoolRecords]);

  const normalizedTasks = useMemo(
    () => tasks.map(task => ({ ...task, status: normalizeKolOutreachStatus(task.status) })),
    [tasks]
  );

  const statusColumns = useMemo(() => defaultKolOutreachStatusColumns(), []);

  const assigneeOptions = useMemo(
    () => buildTeamAssigneeOptions(teamMembers, { displayName }),
    [teamMembers, displayName]
  );

  const platformOptions = useMemo(
    () => collectOutreachPlatformOptions(normalizedTasks, poolRecords),
    [normalizedTasks, poolRecords]
  );

  const countryOptions = useMemo(
    () => collectOutreachCountryOptions(normalizedTasks, poolRecords),
    [normalizedTasks, poolRecords]
  );

  useEffect(() => {
    if (platformFilter === 'all') return;
    if (!platformOptions.some(option => option.key === platformFilter)) {
      setPlatformFilter('all');
    }
  }, [platformFilter, platformOptions]);

  useEffect(() => {
    if (countryFilter === 'all') return;
    if (!countryOptions.some(option => option.key === countryFilter)) {
      setCountryFilter('all');
    }
  }, [countryFilter, countryOptions]);

  const filtered = useMemo(
    () =>
      filterOutreachTasks(normalizedTasks, {
        query,
        initiative: initiativeFilter,
        assignee: assigneeFilter,
        dealType: dealTypeFilter,
        platform: platformFilter,
        country: countryFilter,
        approachDirection: approachDirectionFilter,
        poolRecords,
      }),
    [
      normalizedTasks,
      query,
      initiativeFilter,
      assigneeFilter,
      dealTypeFilter,
      platformFilter,
      countryFilter,
      approachDirectionFilter,
      poolRecords,
    ]
  );

  const phaseCounts = useMemo(() => {
    const map = { all: filtered.length };
    for (const col of statusColumns) {
      map[col.id] = filtered.filter(task => task.status === col.id).length;
    }
    return map;
  }, [filtered, statusColumns]);

  function statusLabel(statusId) {
    const key = STATUS_LABEL_KEYS[statusId];
    return key ? t(key) : statusId;
  }

  const phaseHints = useMemo(
    () => [
      { id: 'all', label: t('hub.campaignKol.filterAll'), count: phaseCounts.all },
      ...statusColumns.map(col => ({
        id: col.id,
        label: statusLabel(col.id),
        count: phaseCounts[col.id] ?? 0,
      })),
    ],
    [phaseCounts, statusColumns, t]
  );

  const patchTask = useCallback(async (taskId, patch) => {
    const res = await fetch(API_V1.internalTask(taskId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = body?.error || 'patch_failed';
      const err = new Error(code);
      err.code = code;
      err.detail = body?.detail;
      throw err;
    }
    return unwrapData(body, 'task')?.task;
  }, []);

  const filteredIds = useMemo(() => new Set(filtered.map(task => task.id)), [filtered]);

  useEffect(() => {
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => filteredIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredIds]);

  function toggleSelect(taskId) {
    if (!taskId) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map(task => task.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkAssignee('');
    setSelectMode(false);
  }

  async function handleBulkAssign() {
    const assignee = bulkAssignee.trim();
    if (!assignee || selectedIds.size === 0) return;
    setBusy(true);
    try {
      const ids = [...selectedIds];
      const results = await Promise.allSettled(
        ids.map(id => patchTask(id, { assignee }))
      );
      const ok = results.filter(r => r.status === 'fulfilled').length;
      if (ok) {
        toast.success(t('hub.campaignKol.bulkAssignSuccess').replace('{count}', String(ok)));
        clearSelection();
        await onTasksChanged?.();
        signalHubNotificationsRefresh();
      }
      if (ok < ids.length) toast.error(t('common.somethingWrong'));
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  async function syncPoolProducts(task, productRows) {
    const poolId = taskPoolId(task);
    if (!poolId || !productRows?.length) return;
    const pool = poolRecordForTask(task, poolRecords);
    if (!pool) return;
    const collaboration_products = appendProductsToPoolRecord(
      pool,
      productRows,
      task.custom_values?.[KOL_BOARD_PROP.initiative]
    );
    const res = await fetch(API_V1.marketingKolPoolRecord(poolId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ collaboration_products }),
    });
    if (!res.ok) return;
    const data = unwrapData(await res.json());
    const record = data?.record || data;
    if (record?.notion_page_id) {
      setPoolRecords(current =>
        current.map(row => (row.notion_page_id === record.notion_page_id ? record : row))
      );
    }
  }

  async function handleCardSave({ assignee, custom_values, productRows = [] }) {
    if (!cardTask?.id) return;
    setBusy(true);
    try {
      await patchTask(cardTask.id, { assignee, custom_values });
      if (productRows.length) {
        await syncPoolProducts(
          { ...cardTask, custom_values },
          productRows
        );
      }
      setCardTask(null);
      await onTasksChanged?.();
      signalHubNotificationsRefresh();
    } catch (err) {
      if (err?.code?.startsWith('kol_order_number_')) {
        orderNumberErrorToast(err.code, err.detail);
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleTransitionConfirm(payload) {
    if (!transition?.task?.id) return;
    const { steps, stepIndex } = transition;
    setBusy(true);
    try {
      const poolId = taskPoolId(transition.task);
      if (payload.poolShippingPatch && poolId) {
        const res = await fetch(API_V1.marketingKolPoolRecord(poolId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload.poolShippingPatch),
        });
        if (res.ok) {
          const data = unwrapData(await res.json());
          const record = data?.record || data;
          if (record?.notion_page_id) {
            setPoolRecords(current =>
              current.map(row => (row.notion_page_id === record.notion_page_id ? record : row))
            );
          }
        }
      }

      const patched = await patchTask(transition.task.id, {
        status: payload.status,
        custom_values: payload.custom_values,
      });
      if (payload.status === 'deal') {
        await syncPoolProducts(
          { ...transition.task, custom_values: payload.custom_values },
          payload.productRows
        );
      }

      const nextTask = {
        ...transition.task,
        ...(patched || {}),
        status: payload.status,
        custom_values: payload.custom_values,
      };

      const nextIndex = stepIndex + 1;
      if (nextIndex < steps.length) {
        setTransition({ task: nextTask, steps, stepIndex: nextIndex });
      } else {
        setTransition(null);
        await onTasksChanged?.();
        signalHubNotificationsRefresh();
      }
    } catch (err) {
      if (err?.code?.startsWith('kol_order_number_')) {
        orderNumberErrorToast(err.code, err.detail);
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFollowUpSave(patch) {
    if (!followUpTask?.id) return;
    setBusy(true);
    try {
      await patchTask(followUpTask.id, patch);
      setFollowUpTask(null);
      toast.success(t('hub.campaignKol.followUpSaved'));
      await onTasksChanged?.();
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCardDelete() {
    if (!cardTask?.id) return;
    const confirmed = await requestConfirm({
      title: t('hub.campaignKol.removeCard'),
      message: t('hub.campaignKol.removeCardConfirm'),
      confirmLabel: t('hub.campaignKol.removeCard'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalTask(cardTask.id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      setCardTask(null);
      toast.success(t('hub.campaignKol.removed'));
      await onTasksChanged?.();
      signalHubNotificationsRefresh();
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  function handleTransitionClose() {
    const hadProgress = transition?.stepIndex > 0;
    setTransition(null);
    if (hadProgress) {
      onTasksChanged?.();
      signalHubNotificationsRefresh();
    }
  }

  function handleStatusChange(task, toStatus) {
    const steps = kolTransitionSteps(task.status, toStatus);
    if (!steps.length) return;
    setTransition({ task, steps, stepIndex: 0 });
  }

  const initiativeCounts = useMemo(() => {
    const map = Object.fromEntries(KOL_INITIATIVES.map(item => [item.id, 0]));
    for (const task of normalizedTasks) {
      const id = taskInitiative(task);
      if (id in map) map[id] += 1;
    }
    return map;
  }, [normalizedTasks]);

  const activeTransitionStatus = transition?.steps?.[transition.stepIndex] || null;

  const orderNumberRegistry = useMemo(() => {
    const latestSeq = latestKolOrderNumberSequence(normalizedTasks);
    const latest = latestSeq > 0 ? formatKolOrderNumber(latestSeq) : null;
    const next = suggestNextKolOrderNumber(normalizedTasks);
    return { latest, next };
  }, [normalizedTasks]);

  const selectedWeibinExportIds = useMemo(
    () => normalizedTasks
      .filter(task => selectedIds.has(task.id) && isKolWeibinExportStatus(task.status))
      .map(task => task.id),
    [normalizedTasks, selectedIds]
  );

  function exportSelectedWeibinExcel() {
    if (!selectedWeibinExportIds.length) {
      toast.error(t('hub.campaignKol.weibinExportSelectedEmpty'));
      return;
    }
    openKolWeibinExport({ taskIds: selectedWeibinExportIds });
  }

  function orderNumberErrorToast(code, detail) {
    if (code === 'kol_order_number_duplicate') {
      toast.error(
        t('hub.campaignKol.orderNumberDuplicateServer').replace('{name}', String(detail || '—'))
      );
      return;
    }
    if (code === 'kol_order_number_invalid') {
      toast.error(t('hub.campaignKol.orderNumberInvalidFormat'));
      return;
    }
    if (code === 'kol_order_number_reserved') {
      toast.error(
        t('hub.campaignKol.orderNumberReserved')
          .replace('{latest}', formatKolOrderNumber(KOL_ORDER_NUMBER_EXTERNAL_FLOOR))
          .replace('{next}', String(detail || suggestNextKolOrderNumber(normalizedTasks)))
      );
      return;
    }
    toast.error(t('common.somethingWrong'));
  }

  return (
    <>
      <DataWorkspaceShell
        className="kol-outreach-workspace"
        title={t('hub.campaignKol.title')}
        subtitle={t('hub.campaignKol.subtitle')}
        meta={t('hub.campaignKol.humanHintKanban')}
        actions={(
          <KolOutreachBoardActions
            tasks={normalizedTasks}
            initialPoolRecords={poolRecords}
            onTasksChanged={onTasksChanged}
            canCreate={canCreate}
            initiative={initiativeFilter}
            existingKeys={existingOutreachKeys(normalizedTasks)}
          />
        )}
        tabs={phaseHints}
        tabsInteractive={false}
        tabsAriaLabel={t('hub.campaignKol.phaseSummary')}
        searchQuery={query}
        onSearchChange={setQuery}
        searchPlaceholder={t('hub.kol.searchPlaceholder')}
        resultCount={filtered.length}
        resultCountLabel={t('hub.kol.showing')}
        empty={filtered.length === 0 ? t('hub.campaignKol.empty') : null}
      >
        <div className="kol-outreach-toolbar">
          <div
            className="kol-outreach-initiative-toggle"
            role="tablist"
            aria-label={t('hub.campaignKol.initiative')}
          >
            {KOL_INITIATIVES.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className={initiativeFilter === item.id ? 'is-active' : ''}
                aria-selected={initiativeFilter === item.id}
                onClick={() => selectInitiative(item.id)}
              >
                {item.label}
                <span className="kol-outreach-initiative-count">{initiativeCounts[item.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <p className="kol-order-number-board-note">
            {orderNumberRegistry.latest
              ? t('hub.campaignKol.orderNumberBoardNote')
                .replace('{latest}', orderNumberRegistry.latest)
                .replace('{next}', orderNumberRegistry.next)
              : t('hub.campaignKol.orderNumberBoardNoteEmpty')
                .replace('{next}', orderNumberRegistry.next)}
          </p>

          <div className="kol-outreach-view-toggle" role="tablist" aria-label={t('hub.campaignKol.viewToggle')}>
            {!selectMode ? (
              <button
                type="button"
                className="kol-outreach-select-toggle"
                onClick={() => setSelectMode(true)}
              >
                {t('hub.campaignKol.enterSelectMode')}
              </button>
            ) : null}
            <button
              type="button"
              className={view === 'board' ? 'is-active' : ''}
              onClick={() => setView('board')}
            >
              {t('hub.internal.viewBoard')}
            </button>
            <button
              type="button"
              className={view === 'list' ? 'is-active' : ''}
              onClick={() => setView('list')}
            >
              {t('hub.internal.viewList')}
            </button>
          </div>

          <label className="kol-outreach-filter">
            <span>{t('hub.internal.taskPanel.assignee')}</span>
            <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
              <option value="all">{t('hub.campaignKol.filterAll')}</option>
              {assigneeOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="kol-outreach-filter">
            <span>{t('hub.kol.colCountry')}</span>
            <select
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              aria-label={t('hub.kol.filterCountry')}
            >
              <option value="all">{t('hub.campaignKol.filterAll')}</option>
              {countryOptions.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="kol-outreach-filter">
            <span>{t('hub.kol.colPlatform')}</span>
            <select
              value={platformFilter}
              onChange={e => setPlatformFilter(e.target.value)}
              aria-label={t('hub.kol.filterPlatform')}
            >
              <option value="all">{t('hub.campaignKol.filterAll')}</option>
              {platformOptions.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="kol-outreach-filter">
            <span>{t('hub.campaignKol.approachDirection')}</span>
            <select
              value={approachDirectionFilter}
              onChange={e => setApproachDirectionFilter(e.target.value)}
              aria-label={t('hub.campaignKol.filterApproachDirection')}
            >
              <option value="all">{t('hub.campaignKol.filterAll')}</option>
              {KOL_APPROACH_DIRECTIONS.map(item => (
                <option key={item.id} value={item.id}>
                  {item.id === 'outbound'
                    ? t('hub.campaignKol.approachOutbound')
                    : t('hub.campaignKol.approachInbound')}
                </option>
              ))}
            </select>
          </label>

          <label className="kol-outreach-filter">
            <span>{t('hub.campaignKol.colDealType')}</span>
            <select
              value={dealTypeFilter}
              onChange={e => setDealTypeFilter(e.target.value)}
              aria-label={t('hub.campaignKol.colDealType')}
            >
              <option value="all">{t('hub.campaignKol.filterAll')}</option>
              {KOL_DEAL_TYPES.map(item => (
                <option key={item.id} value={item.id}>{t(item.labelKey)}</option>
              ))}
            </select>
          </label>
        </div>

        {(selectedIds.size > 0 || selectMode) ? (
          <div className="kol-outreach-bulk-bar">
            {selectedIds.size > 0 ? (
              <span className="kol-outreach-bulk-count">
                {t('hub.campaignKol.selectedCount').replace('{count}', String(selectedIds.size))}
              </span>
            ) : (
              <span className="kol-outreach-bulk-count is-hint">{t('hub.campaignKol.selectModeHint')}</span>
            )}
            {selectedIds.size > 0 ? (
            <label className="kol-outreach-bulk-assign">
              <span>{t('hub.internal.taskPanel.assignee')}</span>
              <select
                value={bulkAssignee}
                onChange={e => setBulkAssignee(e.target.value)}
                disabled={busy}
              >
                <option value="">{t('hub.internal.taskPanel.assigneeUnassigned')}</option>
                {assigneeOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            ) : null}
            {selectedIds.size > 0 ? (
            <button
              type="button"
              className="appdev-btn-ghost"
              onClick={exportSelectedWeibinExcel}
              disabled={busy || selectedWeibinExportIds.length === 0}
            >
              {t('hub.campaignKol.weibinExportSelected').replace(
                '{count}',
                String(selectedWeibinExportIds.length)
              )}
            </button>
            ) : null}
            {selectedIds.size > 0 ? (
            <button
              type="button"
              className="appdev-btn-primary"
              onClick={handleBulkAssign}
              disabled={busy || !bulkAssignee.trim() || selectedIds.size === 0}
            >
              {t('hub.campaignKol.bulkAssign')}
            </button>
            ) : null}
            {selectMode && selectedIds.size < filtered.length ? (
              <button type="button" className="appdev-btn-ghost" onClick={selectAllFiltered} disabled={busy}>
                {t('hub.campaignKol.selectAllVisible')}
              </button>
            ) : null}
            <button type="button" className="appdev-btn-ghost" onClick={clearSelection} disabled={busy}>
              {selectMode && selectedIds.size === 0
                ? t('hub.campaignKol.exitSelectMode')
                : t('hub.campaignKol.clearSelection')}
            </button>
          </div>
        ) : null}

        {view === 'board' ? (
          <KolOutreachKanban
            tasks={filtered}
            poolRecords={poolRecords}
            displayName={displayName}
            isManager={Boolean(actor?.isManager)}
            isAdmin={Boolean(actor?.isAdmin)}
            initiativeFilter={initiativeFilter}
            selectedIds={selectedIds}
            onToggleSelect={selectMode ? toggleSelect : undefined}
            onStatusChange={handleStatusChange}
            onOpenCard={setCardTask}
            onMoreInfo={setMoreInfoTask}
            onFollowUp={setFollowUpTask}
          />
        ) : (
          <div className="kol-pool-table-wrap h-scroll">
            <table className="kol-pool-table kol-outreach-table">
              <thead>
                <tr>
                  {selectMode ? (
                    <th className="kol-outreach-select-col">
                      <button
                        type="button"
                        className={`kol-outreach-card-pick is-table${filtered.length > 0 && filtered.every(task => selectedIds.has(task.id)) ? ' is-on' : ''}`}
                        aria-label={t('hub.campaignKol.selectAllVisible')}
                        aria-pressed={filtered.length > 0 && filtered.every(task => selectedIds.has(task.id))}
                        onClick={() => {
                          if (filtered.length > 0 && filtered.every(task => selectedIds.has(task.id))) {
                            setSelectedIds(new Set());
                            setBulkAssignee('');
                          } else {
                            selectAllFiltered();
                          }
                        }}
                      />
                    </th>
                  ) : null}
                  <th>{t('hub.kol.colChannel')}</th>
                  <th>{t('hub.campaignKol.initiative')}</th>
                  <th>{t('hub.campaignKol.colStatus')}</th>
                  <th>{t('hub.internal.taskPanel.assignee')}</th>
                  <th>{t('hub.campaignKol.colDealType')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => (
                  <tr
                    key={task.id}
                    className={`kol-pool-row-click${selectedIds.has(task.id) ? ' is-selected' : ''}`}
                    onClick={() => setCardTask(task)}
                  >
                    {selectMode ? (
                      <td className="kol-outreach-select-col" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`kol-outreach-card-pick is-table${selectedIds.has(task.id) ? ' is-on' : ''}`}
                          aria-label={t('hub.campaignKol.selectCard')}
                          aria-pressed={selectedIds.has(task.id)}
                          onClick={() => toggleSelect(task.id)}
                        />
                      </td>
                    ) : null}
                    <td className="kol-pool-channel">{task.title}</td>
                    <td>{initiativeLabel(task.custom_values?.[KOL_BOARD_PROP.initiative])}</td>
                    <td>
                      <span className={`kol-outreach-status is-${task.status}`}>
                        {statusLabel(task.status)}
                      </span>
                    </td>
                    <td>{task.assignee || '—'}</td>
                    <td>{task.custom_values?.[KOL_BOARD_PROP.dealType] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataWorkspaceShell>

      <KolOutreachCardModal
        open={Boolean(cardTask)}
        task={cardTask}
        teamMembers={teamMembers}
        displayName={displayName}
        defaultInitiative={initiativeFilter}
        onClose={() => setCardTask(null)}
        onSave={handleCardSave}
        onDelete={cardTask && canDeleteTaskFor(cardTask) ? handleCardDelete : undefined}
        busy={busy}
        outreachTasks={normalizedTasks}
      />

      <KolOutreachMoreInfoModal
        open={Boolean(moreInfoTask)}
        task={moreInfoTask}
        poolRecord={moreInfoTask ? poolRecordForTask(moreInfoTask, poolRecords) : null}
        onClose={() => setMoreInfoTask(null)}
        onSaved={record => {
          if (record?.notion_page_id) {
            setPoolRecords(current => {
              const idx = current.findIndex(row => row.notion_page_id === record.notion_page_id);
              if (idx === -1) return [...current, record];
              return current.map(row => (row.notion_page_id === record.notion_page_id ? record : row));
            });
          }
        }}
      />

      <KolOutreachFollowUpModal
        open={Boolean(followUpTask)}
        task={followUpTask}
        onClose={() => setFollowUpTask(null)}
        onSave={handleFollowUpSave}
        busy={busy}
      />

      <KolOutreachTransitionModal
        key={activeTransitionStatus || 'closed'}
        open={Boolean(transition)}
        task={transition?.task}
        toStatus={activeTransitionStatus}
        stepIndex={transition?.stepIndex ?? 0}
        stepCount={transition?.steps?.length ?? 0}
        displayName={displayName}
        poolRecord={transition?.task ? poolRecordForTask(transition.task, poolRecords) : null}
        outreachTasks={normalizedTasks}
        onClose={handleTransitionClose}
        onConfirm={handleTransitionConfirm}
        busy={busy}
      />

      {confirmDialog}
    </>
  );
}
