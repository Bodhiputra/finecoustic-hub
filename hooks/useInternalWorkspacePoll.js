'use client';

import { useCallback, useEffect, useRef } from 'react';
import { API_V1, unwrapData } from '@/lib/api/routes';

/** Poll open flow/kanban workspaces so cross-user edits appear without hard refresh. */
export const WORKSPACE_SYNC_MS = 30_000;

/** Skip remote overwrite briefly after local saves (matches Appdev board pattern). */
export const LOCAL_EDIT_QUIET_MS = 3_000;

/**
 * @param {object} options
 * @param {boolean} [options.enabled]
 * @param {string} [options.campaignId] — when set, polls campaign flow_data
 * @param {(campaign: object) => void} [options.onCampaignUpdate]
 * @param {() => void | Promise<void>} [options.onTasksUpdate]
 * @param {React.MutableRefObject<number>} [options.quietUntilRef]
 */
export function useInternalWorkspacePoll({
  enabled = false,
  campaignId = '',
  onCampaignUpdate,
  onTasksUpdate,
  quietUntilRef,
} = {}) {
  const lastCampaignUpdatedAtRef = useRef('');
  const onCampaignUpdateRef = useRef(onCampaignUpdate);
  const onTasksUpdateRef = useRef(onTasksUpdate);
  onCampaignUpdateRef.current = onCampaignUpdate;
  onTasksUpdateRef.current = onTasksUpdate;

  useEffect(() => {
    lastCampaignUpdatedAtRef.current = '';
  }, [campaignId]);

  const sync = useCallback(async () => {
    if (!enabled) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (quietUntilRef?.current && Date.now() < quietUntilRef.current) return;

    if (campaignId && onCampaignUpdateRef.current) {
      try {
        const res = await fetch(API_V1.internalCampaign(campaignId), { credentials: 'same-origin' });
        if (res.ok) {
          const body = await res.json();
          const data = unwrapData(body);
          const campaign = data?.campaign;
          const updatedAt = campaign?.updated_at || '';
          if (campaign?.id && updatedAt !== lastCampaignUpdatedAtRef.current) {
            lastCampaignUpdatedAtRef.current = updatedAt;
            onCampaignUpdateRef.current(campaign);
          }
        }
      } catch {
        /* ignore transient network errors */
      }
    }

    if (onTasksUpdateRef.current) {
      try {
        await onTasksUpdateRef.current();
      } catch {
        /* ignore */
      }
    }
  }, [enabled, campaignId, quietUntilRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    const startupId = window.setTimeout(sync, 2_000);
    const intervalId = window.setInterval(sync, WORKSPACE_SYNC_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(startupId);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, campaignId, sync]);

  const markCampaignSynced = useCallback((updatedAt = '') => {
    lastCampaignUpdatedAtRef.current = String(updatedAt || '');
  }, []);

  return { markCampaignSynced };
}

export function bumpLocalEditQuiet(quietUntilRef, ms = LOCAL_EDIT_QUIET_MS) {
  if (!quietUntilRef) return;
  quietUntilRef.current = Date.now() + ms;
}
