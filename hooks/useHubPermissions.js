'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  canDeleteTask,
  canDeleteBoard,
  canDeleteCampaign,
  hubActorFromClient,
  hubPermissionsForClient,
} from '@/lib/hub-permissions';
import { useHubSessionProfile } from '@/hooks/useHubSession';

export function useHubPermissions(initialProfile = null) {
  const sessionProfile = useHubSessionProfile();
  const resolvedInitial = initialProfile ?? sessionProfile ?? null;
  const seedDisplayName = resolvedInitial?.displayName || '';
  const seedHubUserId = resolvedInitial?.hubUser?.id || '';
  const hasSeedHubUser = Boolean(resolvedInitial?.hubUser);

  const [profile, setProfile] = useState(
    () => resolvedInitial ?? { displayName: '', hubUser: null }
  );
  const [loading, setLoading] = useState(!hasSeedHubUser);

  useEffect(() => {
    if (!hasSeedHubUser || !resolvedInitial) return;
    setProfile({
      displayName: resolvedInitial.displayName || '',
      hubUser: resolvedInitial.hubUser,
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when server seed identity changes, not object reference
  }, [hasSeedHubUser, seedDisplayName, seedHubUserId]);

  useEffect(() => {
    if (hasSeedHubUser) return;

    let cancelled = false;
    fetch('/api/auth/me?scope=hub', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setProfile({ displayName: data.displayName || '', hubUser: data.hubUser });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasSeedHubUser, seedDisplayName]);

  const actor = useMemo(() => hubActorFromClient(profile), [profile]);

  const permissions = useMemo(() => {
    if (profile?.hubUser?.permissions) return profile.hubUser.permissions;
    if (actor) return hubPermissionsForClient(actor);
    return null;
  }, [profile, actor]);

  const canDeleteTaskFor = useCallback(
    task => Boolean(actor && canDeleteTask(actor, task)),
    [actor]
  );

  const canDeleteBoardFor = useCallback(
    board => Boolean(actor && canDeleteBoard(actor, board)),
    [actor]
  );

  const canDeleteCampaignFor = useCallback(
    campaign => Boolean(actor && canDeleteCampaign(actor, campaign)),
    [actor]
  );

  return { profile, actor, permissions, loading, canDeleteTaskFor, canDeleteBoardFor, canDeleteCampaignFor };
}
