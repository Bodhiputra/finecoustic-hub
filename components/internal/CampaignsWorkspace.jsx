'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { API_V1, unwrapData } from '@/lib/api/routes';

function campaignsUrl({ boardId } = {}) {
  const params = new URLSearchParams({ tool: 'campaigns' });
  if (boardId) params.set('board', boardId);
  return `/marketing?${params.toString()}`;
}

export default function CampaignsWorkspace({ departmentId = 'marketing', initialCampaigns = null }) {
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
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
    const name = window.prompt(t('hub.internal.campaignNamePrompt'));
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaigns, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: name.trim(), department: departmentId }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createBoard(campaignId) {
    const name = window.prompt(t('hub.internal.boardNamePrompt'));
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.internalCampaignBoards(campaignId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: name.trim(), department: departmentId }),
      });
      if (res.ok) await refresh();
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
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="internal-empty">{t('hub.internal.loadingCampaigns')}</p>;
  }

  return (
    <section className="internal-campaigns" aria-label={t('hub.internal.campaigns')}>
      <header className="internal-campaigns-head">
        <div>
          <h2>{t('hub.internal.campaigns')}</h2>
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
        <p className="internal-empty">{t('hub.internal.noCampaigns')}</p>
      ) : (
        <ul className="internal-campaigns-list">
          {campaigns.map(campaign => (
            <li key={campaign.id} className="internal-campaign-card">
              <div className="internal-campaign-card-head">
                <div>
                  <h3>{campaign.name}</h3>
                  {campaign.description ? (
                    <p className="internal-campaign-card-desc">{campaign.description}</p>
                  ) : null}
                </div>
                <div className="internal-campaign-card-actions">
                  <button
                    type="button"
                    className="appdev-btn-ghost"
                    onClick={() => createBoard(campaign.id)}
                    disabled={busy}
                  >
                    <Icon name="plus" size={14} />
                    {t('hub.internal.addBoard')}
                  </button>
                  <button
                    type="button"
                    className="appdev-btn-ghost is-danger"
                    onClick={() => removeCampaign(campaign)}
                    disabled={busy}
                    aria-label={t('hub.internal.deleteCampaign')}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </div>
              {campaign.boards?.length ? (
                <ul className="internal-board-list">
                  {campaign.boards.map(board => (
                    <li key={board.id}>
                      <Link href={campaignsUrl({ boardId: board.id })} className="internal-board-link">
                        <Icon name="kanban" size={15} />
                        <span>{board.name}</span>
                        <span className="internal-board-link-meta">
                          {t('hub.internal.openBoard')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="internal-campaign-card-empty">{t('hub.internal.noBoards')}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmDialog}
    </section>
  );
}
