'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import CampaignFlowInline from '@/components/internal/CampaignFlowInline';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useHubPermissions } from '@/hooks/useHubPermissions';
import { usePrompt } from '@/hooks/usePrompt';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { isFrameworkMapCampaign } from '@/lib/framework-map';

export default function CampaignsWorkspace({
  initialProfile = null,
  initialCampaigns = null,
  activeFlowId = '',
  onOpenFlow,
  onCloseFlow,
  onOpenNewTask,
  onTaskClick,
  savedFlowTask = null,
  onSavedFlowTaskHandled,
  tasksRefreshKey = 0,
}) {
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const { requestPrompt, promptDialog } = usePrompt();
  const { toast, toastStack } = useToast();
  const { permissions, canDeleteCampaignFor } = useHubPermissions(initialProfile);
  const canCreate = permissions?.canCreateCampaign ?? false;
  const hasServerSeed = initialCampaigns != null;
  const [campaigns, setCampaigns] = useState(() => initialCampaigns ?? []);
  const [loading, setLoading] = useState(() => !hasServerSeed);
  const [busy, setBusy] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(() => hasServerSeed);

  const refresh = useCallback(async () => {
    const res = await fetch(API_V1.internalCampaigns, {
      credentials: 'same-origin',
    });
    if (!res.ok) return false;
    const body = await res.json();
    const data = unwrapData(body);
    setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
    setLoadedOnce(true);
    return true;
  }, []);

  useEffect(() => {
    if (loadedOnce) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [loadedOnce, refresh]);

  async function createCampaign(mapMode = 'workflow') {
    const isFramework = mapMode === 'framework';
    const name = await requestPrompt({
      title: isFramework ? t('hub.internal.addFrameworkMap') : t('hub.internal.addCampaign'),
      label: t('hub.internal.campaignNamePrompt'),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    });
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaigns, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name,
          department: 'all',
          flow_enabled: true,
          map_mode: mapMode,
        }),
      });
      if (res.ok) {
        const body = await res.json();
        const data = unwrapData(body);
        await refresh();
        toast.success(
          isFramework ? t('hub.internal.frameworkMapCreated') : t('hub.internal.campaignCreated')
        );
        if (isFramework && data?.campaign?.id) {
          onOpenFlow?.(data.campaign.id);
        }
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function renameCampaign(campaign) {
    const name = await requestPrompt({
      title: t('hub.internal.renameCampaign'),
      label: t('hub.internal.campaignNamePrompt'),
      defaultValue: campaign.name,
      confirmLabel: t('common.save'),
      cancelLabel: t('common.cancel'),
      maxLength: 120,
    });
    if (!name || name === campaign.name) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaign(campaign.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        await refresh();
        toast.success(t('hub.internal.campaignRenamed'));
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeCampaign(campaign) {
    const ok = await requestConfirm({
      title: t('hub.internal.deleteCampaign'),
      message: t('hub.internal.deleteCampaignConfirm').replace('{name}', campaign.name),
      confirmLabel: t('hub.internal.taskPanel.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaign(campaign.id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        if (activeFlowId === campaign.id) onCloseFlow?.();
        await refresh();
        toast.success(t('hub.internal.campaignDeleted'));
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  if (activeFlowId) {
    return (
      <>
        <CampaignFlowInline
          campaignId={activeFlowId}
          initialCampaigns={campaigns.length ? campaigns : initialCampaigns}
          initialProfile={initialProfile}
          onBack={onCloseFlow}
          onTaskClick={onTaskClick}
          onOpenNewTask={onOpenNewTask}
          savedFlowTask={savedFlowTask}
          onSavedFlowTaskHandled={onSavedFlowTaskHandled}
          tasksRefreshKey={tasksRefreshKey}
        />
        {confirmDialog}
        {promptDialog}
        {toastStack}
      </>
    );
  }

  if (loading) {
    return <p className="internal-empty">{t('hub.internal.loadingCampaigns')}</p>;
  }

  return (
    <section className="internal-campaigns" aria-label={t('hub.internal.campaignList')}>
      <header className="internal-campaigns-head">
        <div>
          <h2>{t('hub.internal.campaignList')}</h2>
        </div>
        {canCreate ? (
          <div className="internal-campaigns-head-actions">
            <button
              type="button"
              className="appdev-btn-primary"
              onClick={() => createCampaign('workflow')}
              disabled={busy}
            >
              <Icon name="plus" size={16} />
              {t('hub.internal.addCampaign')}
            </button>
            <button
              type="button"
              className="appdev-btn-ghost"
              onClick={() => createCampaign('framework')}
              disabled={busy}
            >
              <Icon name="flow" size={16} />
              {t('hub.internal.addFrameworkMap')}
            </button>
          </div>
        ) : null}
      </header>

      {campaigns.length === 0 ? (
        <div className="internal-campaigns-empty">
          <Icon name="megaphone" size={28} />
          <p>{t('hub.internal.noCampaigns')}</p>
          {canCreate ? (
          <div className="internal-campaigns-empty-actions">
            <button type="button" className="appdev-btn-primary" onClick={() => createCampaign('workflow')} disabled={busy}>
              <Icon name="plus" size={16} />
              {t('hub.internal.addCampaign')}
            </button>
            <button type="button" className="appdev-btn-ghost" onClick={() => createCampaign('framework')} disabled={busy}>
              <Icon name="flow" size={16} />
              {t('hub.internal.addFrameworkMap')}
            </button>
          </div>
          ) : null}
        </div>
      ) : (
        <ul className="internal-campaigns-grid">
          {campaigns.map(campaign => {
            const frameworkMap = isFrameworkMapCampaign(campaign);
            return (
            <li key={campaign.id} className="internal-campaign-card-item">
              <button
                type="button"
                className={`internal-campaign-card internal-campaign-card--clickable${frameworkMap ? ' is-framework-map' : ''}`}
                onClick={() => onOpenFlow?.(campaign.id)}
              >
                <header className="internal-campaign-card-top">
                  <div className="internal-campaign-card-icon" aria-hidden="true">
                    <Icon name={frameworkMap ? 'layout' : 'flow'} size={18} />
                  </div>
                  <div className="internal-campaign-card-title-wrap">
                    <h3>{campaign.name}</h3>
                    <p className="internal-campaign-card-meta">
                      {frameworkMap
                        ? t('hub.internal.frameworkMapMeta')
                        : t('hub.internal.campaignFlowOnlyMeta')}
                    </p>
                  </div>
                </header>

                {campaign.description ? (
                  <p className="internal-campaign-card-desc">{campaign.description}</p>
                ) : null}
              </button>
              {canDeleteCampaignFor(campaign) ? (
                <div className="internal-campaign-card-actions">
                  <button
                    type="button"
                    className="appdev-btn-ghost internal-campaign-card-rename"
                    onClick={() => renameCampaign(campaign)}
                    disabled={busy}
                    aria-label={t('hub.internal.renameCampaign')}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="appdev-btn-ghost is-danger internal-campaign-card-delete"
                    onClick={() => removeCampaign(campaign)}
                    disabled={busy}
                    aria-label={t('hub.internal.deleteCampaign')}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ) : null}
            </li>
            );
          })}
        </ul>
      )}

      {confirmDialog}
      {promptDialog}
      {toastStack}
    </section>
  );
}
