'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import KanbanCreateModal from '@/components/internal/KanbanCreateModal';
import { useLocale } from '@/components/LocaleProvider';
import { useHubPermissions } from '@/hooks/useHubPermissions';
import { useToast } from '@/hooks/useToast';
import { API_V1, internalTasksQuery, unwrapData } from '@/lib/api/routes';
import { campaignBoardUrl } from '@/lib/campaign-urls';
import { appendKanbanNodeToFlow, appendTaskNodeToFlow } from '@/lib/campaign-flow-utils';
import { dispatchBoardsChanged } from '@/lib/internal-boards';
import { useFlowKanbanPickerBoards } from '@/hooks/useFlowKanbanPickerBoards';
import { flowStatusColumns, statusColumnLabel } from '@/lib/internal-campaigns';

const CampaignFlowCanvas = dynamic(() => import('@/components/internal/CampaignFlowCanvas'), { ssr: false });

/** Campaign flow canvas on hub home — no /campaigns route change. */
export default function CampaignFlowInline({
  campaignId = '',
  initialCampaigns = null,
  initialProfile = null,
  onBack,
  onTaskClick,
  onOpenNewTask,
  savedFlowTask = null,
  onSavedFlowTaskHandled,
  tasksRefreshKey = 0,
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const { permissions } = useHubPermissions(initialProfile);
  const canCreate = permissions?.canCreateCampaign ?? false;
  const canEditBoard = permissions?.canEditBoardConfig ?? false;
  const [kanbanCreateOpen, setKanbanCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const seeded = useMemo(
    () => initialCampaigns?.find(campaign => campaign.id === campaignId) || null,
    [initialCampaigns, campaignId]
  );
  const [campaign, setCampaign] = useState(() => seeded);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(() => !seeded);
  const [tasksLoading, setTasksLoading] = useState(true);

  const refreshCampaign = useCallback(async () => {
    if (!campaignId) return null;
    const res = await fetch(API_V1.internalCampaign(campaignId), { credentials: 'same-origin' });
    if (!res.ok) return null;
    const body = await res.json();
    const data = unwrapData(body);
    if (data?.campaign) {
      setCampaign(data.campaign);
      return data.campaign;
    }
    return null;
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return undefined;
    if (seeded) {
      setCampaign(seeded);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    refreshCampaign()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, seeded, refreshCampaign]);

  const refreshTasks = useCallback(async () => {
    if (!campaignId) return;
    setTasksLoading(true);
    try {
      const res = await fetch(
        internalTasksQuery({ campaign_id: campaignId, flow_only: true }),
        { credentials: 'same-origin' }
      );
      if (!res.ok) return;
      const body = await res.json();
      const data = unwrapData(body);
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } finally {
      setTasksLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    refreshTasks();
  }, [campaignId, refreshTasks, tasksRefreshKey]);

  const handleSaveFlowData = useCallback(async flowData => {
    if (!campaign?.id) return;
    try {
      const res = await fetch(API_V1.internalCampaign(campaign.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ flow_data: flowData }),
      });
      if (res.ok) {
        setCampaign(prev => (prev ? { ...prev, flow_data: flowData } : prev));
        return;
      }
      toast.error(t('common.somethingWrong'));
    } catch {
      toast.error(t('common.somethingWrong'));
    }
  }, [campaign?.id, t, toast]);

  useEffect(() => {
    if (!savedFlowTask?.id || !campaign?.id) return;
    let cancelled = false;

    async function appendSavedTask() {
      const nextFlow = appendTaskNodeToFlow(campaign.flow_data, savedFlowTask);
      if (nextFlow === campaign.flow_data) {
        onSavedFlowTaskHandled?.();
        return;
      }
      await handleSaveFlowData(nextFlow);
      if (!cancelled) {
        await refreshTasks();
        onSavedFlowTaskHandled?.();
      }
    }

    appendSavedTask();
    return () => {
      cancelled = true;
    };
  }, [savedFlowTask, campaign, handleSaveFlowData, refreshTasks, onSavedFlowTaskHandled]);

  const kanbanPickerDepartment = campaign?.department || 'marketing';
  const { boards: kanbansNotOnFlow, loading: kanbanPickerLoading } = useFlowKanbanPickerBoards({
    open: kanbanCreateOpen,
    department: kanbanPickerDepartment,
    campaignBoards: campaign?.boards,
    flowData: campaign?.flow_data,
  });

  async function handleAddExistingKanban(board) {
    if (!board?.id || !campaign?.id) return;
    setBusy(true);
    try {
      const nextFlow = appendKanbanNodeToFlow(campaign.flow_data, board);
      if (nextFlow === campaign.flow_data) {
        setKanbanCreateOpen(false);
        return;
      }
      await handleSaveFlowData(nextFlow);
      setCampaign(prev => (prev ? { ...prev, flow_data: nextFlow } : prev));
      setKanbanCreateOpen(false);
      toast.success(t('hub.internal.kanbanAddedToFlow'));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmCampaignKanban({ name, department }) {
    if (!name || !campaign?.id) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaignBoards(campaign.id), {
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
      const nextFlow = appendKanbanNodeToFlow(campaign.flow_data, board, name);
      await handleSaveFlowData(nextFlow);
      setCampaign(prev => ({
        ...prev,
        boards: [...(prev?.boards || []), board],
        flow_data: nextFlow,
      }));
      setKanbanCreateOpen(false);
      toast.success(t('hub.internal.boardCreated'));
    } finally {
      setBusy(false);
    }
  }

  const flowStatusLabel = useCallback(
    statusId => {
      const col = flowStatusColumns().find(c => c.id === statusId);
      return col ? statusColumnLabel(col, t) : statusId;
    },
    [t]
  );

  if (!campaignId) return null;

  if (loading && !campaign) {
    return <p className="internal-empty">{t('hub.internal.loadingCampaigns')}</p>;
  }

  if (!campaign) {
    return (
      <div className="internal-campaign-flow-inline">
        <p className="internal-empty">{t('hub.internal.flowNotFound')}</p>
        <button type="button" className="appdev-btn-ghost" onClick={onBack}>
          {t('hub.internal.backToCampaigns')}
        </button>
      </div>
    );
  }

  return (
    <section className="internal-campaign-flow-inline" aria-label={campaign.name}>
      <header className="internal-campaign-flow-inline-head">
        <button
          type="button"
          className="brand-back internal-campaign-flow-back"
          onClick={onBack}
          aria-label={t('hub.internal.backToCampaigns')}
        >
          <Icon name="chevronLeft" size={16} />
        </button>
        <div className="internal-campaign-flow-inline-title">
          <h2>{campaign.name}</h2>
          <p>{t('hub.internal.campaignFlowOnlyMeta')}</p>
        </div>
      </header>

      {(canCreate || canEditBoard) ? (
        <div className="internal-dept-toolbar internal-dept-toolbar--board internal-campaign-flow-toolbar">
          {canEditBoard ? (
            <button
              type="button"
              className="appdev-btn-ghost"
              onClick={() => setKanbanCreateOpen(true)}
              disabled={busy}
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
                onClick={() => onOpenNewTask?.('milestone')}
                disabled={busy}
              >
                <Icon name="calendar" size={16} />
                {t('hub.internal.addMilestone')}
              </button>
              <button
                type="button"
                className="appdev-btn-primary internal-add-btn"
                onClick={() => onOpenNewTask?.('task')}
                disabled={busy}
              >
                <Icon name="plus" size={16} />
                {t('hub.internal.addTaskIssue')}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {tasksLoading && !tasks.length ? (
        <p className="internal-empty route-loading-inline">{t('hub.internal.loadingCampaigns')}</p>
      ) : (
        <CampaignFlowCanvas
          campaign={campaign}
          tasks={tasks}
          boards={campaign.boards || []}
          onTaskClick={onTaskClick}
          onKanbanClick={boardId => router.push(campaignBoardUrl(boardId))}
          onSaveFlowData={handleSaveFlowData}
          statusLabelFor={flowStatusLabel}
        />
      )}

      <KanbanCreateModal
        open={kanbanCreateOpen}
        title={t('hub.internal.addKanbanNode')}
        showDepartmentPicker
        defaultDepartment="marketing"
        busy={busy}
        existingBoards={kanbansNotOnFlow}
        loadingExisting={kanbanPickerLoading}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setKanbanCreateOpen(false)}
        onSubmit={handleConfirmCampaignKanban}
        onSelectExisting={handleAddExistingKanban}
      />
    </section>
  );
}
