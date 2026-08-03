'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { usePrompt } from '@/hooks/usePrompt';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { campaignBoardUrl, campaignFlowUrl } from '@/lib/campaign-urls';

export default function CampaignsWorkspace({ departmentId = 'marketing', initialCampaigns = null }) {
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const { requestPrompt, promptDialog } = usePrompt();
  const { toast, toastStack } = useToast();
  const [campaigns, setCampaigns] = useState(() => initialCampaigns ?? []);
  const [loading, setLoading] = useState(initialCampaigns == null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (departmentId) params.set('department', departmentId);
    const res = await fetch(`${API_V1.internalCampaigns}?${params.toString()}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return false;
    const body = await res.json();
    const data = unwrapData(body);
    setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
    return true;
  }, [departmentId]);

  useEffect(() => {
    if (initialCampaigns != null) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [initialCampaigns, refresh]);

  async function createCampaign() {
    const name = await requestPrompt({
      title: t('hub.internal.addCampaign'),
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
        body: JSON.stringify({ name, department: departmentId }),
      });
      if (res.ok) {
        await refresh();
        toast.success(t('hub.internal.campaignCreated'));
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function createBoard(campaignId) {
    const name = await requestPrompt({
      title: t('hub.internal.addBoard'),
      label: t('hub.internal.boardNamePrompt'),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    });
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaignBoards(campaignId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, department: departmentId }),
      });
      if (res.ok) {
        await refresh();
        toast.success(t('hub.internal.boardCreated'));
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function enableFlow(campaign) {
    if (campaign.flow_enabled) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaign(campaign.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ flow_enabled: true }),
      });
      if (res.ok) {
        await refresh();
        toast.success(t('hub.internal.flowEnabled'));
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
        await refresh();
        toast.success(t('hub.internal.campaignDeleted'));
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="internal-empty">{t('hub.internal.loadingCampaigns')}</p>;
  }

  return (
    <section className="internal-campaigns" aria-label={t('hub.internal.campaignList')}>
      <header className="internal-campaigns-head">
        <div>
          <h2>{t('hub.internal.campaignList')}</h2>
          <p className="internal-campaigns-desc">{t('hub.internal.campaignsDesc')}</p>
        </div>
        <button
          type="button"
          className="appdev-btn-primary"
          onClick={createCampaign}
          disabled={busy}
        >
          <Icon name="plus" size={16} />
          {t('hub.internal.addCampaign')}
        </button>
      </header>

      {campaigns.length === 0 ? (
        <div className="internal-campaigns-empty">
          <Icon name="megaphone" size={28} />
          <p>{t('hub.internal.noCampaigns')}</p>
          <button type="button" className="appdev-btn-primary" onClick={createCampaign} disabled={busy}>
            <Icon name="plus" size={16} />
            {t('hub.internal.addCampaign')}
          </button>
        </div>
      ) : (
        <ul className="internal-campaigns-grid">
          {campaigns.map(campaign => {
            const boardCount = campaign.boards?.length || 0;
            const hasFlow = Boolean(campaign.flow_enabled);
            const hasWorkstreams = hasFlow || boardCount > 0;
            return (
              <li key={campaign.id}>
                <article className="internal-campaign-card">
                  <header className="internal-campaign-card-top">
                    <div className="internal-campaign-card-icon" aria-hidden="true">
                      <Icon name="megaphone" size={18} />
                    </div>
                    <div className="internal-campaign-card-title-wrap">
                      <h3>{campaign.name}</h3>
                      <p className="internal-campaign-card-meta">
                        {[
                          hasFlow ? t('hub.internal.flowCountOne') : '',
                          boardCount === 1
                            ? t('hub.internal.boardCountOne')
                            : boardCount > 1
                              ? t('hub.internal.boardCount').replace('{count}', String(boardCount))
                              : '',
                        ]
                          .filter(Boolean)
                          .join(' · ') || t('hub.internal.noWorkstreams')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="appdev-btn-ghost is-danger internal-campaign-card-delete"
                      onClick={() => removeCampaign(campaign)}
                      disabled={busy}
                      aria-label={t('hub.internal.deleteCampaign')}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </header>

                  {campaign.description ? (
                    <p className="internal-campaign-card-desc">{campaign.description}</p>
                  ) : null}

                  {hasWorkstreams ? (
                    <ul className="internal-campaign-card-boards">
                      {hasFlow ? (
                        <li>
                          <Link
                            href={campaignFlowUrl(campaign.id)}
                            className="internal-campaign-board-chip internal-campaign-flow-chip"
                          >
                            <Icon name="flow" size={14} />
                            <span>
                              {t('hub.internal.campaignFlowChip').replace('{name}', campaign.name)}
                            </span>
                          </Link>
                        </li>
                      ) : null}
                      {campaign.boards?.map(board => (
                        <li key={board.id}>
                          <Link
                            href={campaignBoardUrl(board.id)}
                            className="internal-campaign-board-chip"
                          >
                            <Icon name="kanban" size={14} />
                            <span>
                              {t('hub.internal.boardWorkstreamChip').replace('{name}', board.name)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="internal-campaign-card-empty">{t('hub.internal.noWorkstreams')}</p>
                  )}

                  <footer className="internal-campaign-card-foot">
                    {!hasFlow ? (
                      <button
                        type="button"
                        className="appdev-btn-ghost"
                        onClick={() => enableFlow(campaign)}
                        disabled={busy}
                      >
                        <Icon name="flow" size={14} />
                        {t('hub.internal.addFlow')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="appdev-btn-ghost"
                      onClick={() => createBoard(campaign.id)}
                      disabled={busy}
                    >
                      <Icon name="plus" size={14} />
                      {t('hub.internal.addBoard')}
                    </button>
                  </footer>
                </article>
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
