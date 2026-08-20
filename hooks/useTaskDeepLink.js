'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { API_V1, unwrapData } from '@/lib/api/routes';

/** Open task panel from ?task= URL param; clear param when panel closes. */
export function useTaskDeepLink({ tasks, panelTask, setPanelTask, enabled = true }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskParam = searchParams.get('task') || '';

  useEffect(() => {
    if (!enabled) return undefined;
    if (!taskParam || panelTask?.id === taskParam) return;

    const found = tasks.find(task => task.id === taskParam);
    if (found) {
      setPanelTask(found);
      return undefined;
    }

    let cancelled = false;
    fetch(API_V1.internalTask(taskParam), { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (cancelled || !body) return;
        const data = unwrapData(body, 'task');
        const task = data?.task || data;
        if (task?.id) setPanelTask(task);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [taskParam, tasks, panelTask?.id, setPanelTask, enabled]);

  const closePanel = useCallback(() => {
    setPanelTask(null);
    if (!taskParam) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('task');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [taskParam, searchParams, pathname, router, setPanelTask]);

  return { taskParam, closePanel };
}
