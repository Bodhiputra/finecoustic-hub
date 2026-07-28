'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_V1, unwrapData, internalTasksQuery } from '@/lib/api/routes';

/**
 * Internal task list — hydrates from server `initialTasks`; refetches when filters
 * change or after explicit `refresh()` (save, status change, delete).
 */
export function useInternalTasks({
  departmentId = '',
  bucket = '',
  boardId = '',
  campaignId = '',
  initialTasks = null,
}) {
  const [tasks, setTasks] = useState(() => initialTasks ?? []);
  const [loading, setLoading] = useState(initialTasks == null);
  const filterKey = `${departmentId}|${bucket}|${boardId}|${campaignId}`;
  const prevFilterKey = useRef(filterKey);
  const seeded = useRef(initialTasks != null);

  useEffect(() => {
    if (initialTasks != null) {
      setTasks(initialTasks);
      seeded.current = true;
    }
  }, [initialTasks]);

  const refresh = useCallback(async () => {
    const res = await fetch(
      internalTasksQuery({
        department: departmentId,
        bucket,
        board_id: boardId,
        campaign_id: campaignId,
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
  }, [departmentId, bucket, boardId, campaignId]);

  useEffect(() => {
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
