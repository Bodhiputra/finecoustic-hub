'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_V1, unwrapData, internalTasksQuery } from '@/lib/api/routes';

function tasksSeedKey(list) {
  if (!Array.isArray(list) || !list.length) return '__empty__';
  return list.map(task => `${task.id}:${task.updated_at || ''}:${task.status || ''}`).join('|');
}

/**
 * Internal task list — hydrates from server `initialTasks`; refetches when filters
 * change or after explicit `refresh()` (save, status change, delete).
 */
export function useInternalTasks({
  departmentId = '',
  bucket = '',
  boardId = '',
  campaignId = '',
  flowOnly = false,
  initialTasks = null,
  enabled = true,
}) {
  const [tasks, setTasks] = useState(() => initialTasks ?? []);
  const [loading, setLoading] = useState(enabled && initialTasks == null);
  const filterKey = `${departmentId}|${bucket}|${boardId}|${campaignId}|${flowOnly ? '1' : '0'}`;
  const prevFilterKey = useRef(filterKey);
  const seeded = useRef(initialTasks != null);
  const lastSeedKey = useRef(initialTasks != null ? tasksSeedKey(initialTasks) : null);

  useEffect(() => {
    if (initialTasks == null) return;
    const key = tasksSeedKey(initialTasks);
    if (lastSeedKey.current === key) return;
    lastSeedKey.current = key;
    setTasks(initialTasks);
    seeded.current = true;
  }, [initialTasks]);

  const refresh = useCallback(async () => {
    if (!enabled) return true;
    const res = await fetch(
      internalTasksQuery({
        department: departmentId,
        bucket,
        board_id: boardId,
        campaign_id: campaignId,
        flow_only: flowOnly,
      }),
      {
      credentials: 'same-origin',
    }
    );
    if (res.ok) {
      const body = await res.json();
      const payload = unwrapData(body);
      setTasks(payload?.tasks ?? []);
    }
    return res.ok;
  }, [departmentId, bucket, boardId, campaignId, flowOnly, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const filterChanged = prevFilterKey.current !== filterKey;
    prevFilterKey.current = filterKey;

    if (!filterChanged) {
      if (!seeded.current) {
        setLoading(true);
        refresh().finally(() => setLoading(false));
      }
      return;
    }

    refresh();
  }, [filterKey, refresh]);

  return { tasks, setTasks, refresh, loading };
}
