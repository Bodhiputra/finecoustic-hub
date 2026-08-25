'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { unwrapData, internalTasksQuery } from '@/lib/api/routes';
import {
  internalTasksFilterKey,
  resolveInternalTasksQuery,
  tasksListSeedKey,
} from '@/lib/internal-tasks-filters';

/**
 * Internal task list — hydrates from server `initialTasks`.
 * Refetches only when filters change without a matching server seed, or on explicit `refresh()`.
 */
export function useInternalTasks({
  departmentId = '',
  viewParam = '',
  boardId = '',
  campaignId = '',
  flowOnly = false,
  initialTasks = null,
  initialTasksFilterKey = null,
  enabled = true,
}) {
  const filterKey = internalTasksFilterKey({
    departmentId,
    viewParam,
    boardId,
    campaignId,
    flowOnly,
  });

  const [tasks, setTasks] = useState(() => initialTasks ?? []);
  const [loading, setLoading] = useState(() => enabled && initialTasksFilterKey !== filterKey);

  const queryRef = useRef({ departmentId, viewParam, boardId, campaignId, flowOnly, enabled });
  queryRef.current = { departmentId, viewParam, boardId, campaignId, flowOnly, enabled };

  const serverSeedFilterKey = useRef(
    initialTasksFilterKey === filterKey ? filterKey : null
  );
  const lastSeedKey = useRef(
    initialTasksFilterKey === filterKey && initialTasks != null
      ? tasksListSeedKey(initialTasks)
      : null
  );
  const prevFilterKey = useRef(filterKey);

  useEffect(() => {
    if (initialTasks == null || initialTasksFilterKey == null) return;
    if (initialTasksFilterKey !== filterKey) return;

    const dataKey = tasksListSeedKey(initialTasks);
    if (lastSeedKey.current === dataKey && serverSeedFilterKey.current === filterKey) return;

    lastSeedKey.current = dataKey;
    serverSeedFilterKey.current = filterKey;
    setTasks(initialTasks);
    setLoading(false);
  }, [initialTasks, initialTasksFilterKey, filterKey]);

  const refresh = useCallback(async () => {
    const q = queryRef.current;
    if (!q.enabled) return true;

    const resolved = resolveInternalTasksQuery({
      departmentId: q.departmentId,
      viewParam: q.viewParam,
      boardId: q.boardId,
      campaignId: q.campaignId,
      flowOnly: q.flowOnly,
    });

    const res = await fetch(
      internalTasksQuery({
        department: resolved.department || undefined,
        bucket: resolved.bucket || undefined,
        board_id: resolved.boardId || undefined,
        campaign_id: resolved.campaignId || undefined,
        flow_only: resolved.flowOnly || undefined,
      }),
      { credentials: 'same-origin' }
    );

    if (res.ok) {
      const body = await res.json();
      const payload = unwrapData(body);
      const nextTasks = payload?.tasks ?? [];
      const nextKey = tasksListSeedKey(nextTasks);
      if (lastSeedKey.current !== nextKey) {
        setTasks(nextTasks);
        lastSeedKey.current = nextKey;
      }
      serverSeedFilterKey.current = internalTasksFilterKey(q);
    }
    return res.ok;
  }, []);

  useEffect(() => {
    if (!enabled) {
      prevFilterKey.current = filterKey;
      setLoading(false);
      return;
    }

    const filterChanged = prevFilterKey.current !== filterKey;
    prevFilterKey.current = filterKey;

    if (filterChanged && serverSeedFilterKey.current !== filterKey) {
      setTasks([]);
    }

    if (serverSeedFilterKey.current === filterKey) {
      setLoading(false);
      return;
    }

    if (!filterChanged && initialTasksFilterKey === filterKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [filterKey, enabled, initialTasksFilterKey, refresh]);

  const mergeTask = useCallback(updated => {
    if (!updated?.id) return;
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }, []);

  const removeTask = useCallback(taskId => {
    if (!taskId) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  return { tasks, setTasks, refresh, mergeTask, removeTask, loading };
}
