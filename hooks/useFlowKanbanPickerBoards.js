'use client';

import { useEffect, useMemo, useState } from 'react';
import { internalBoardsQuery, unwrapData } from '@/lib/api/routes';
import { getFlowKanbanPickerBoards } from '@/lib/campaign-flow-utils';

/** Load department kanbans + merge with campaign boards for the flow-map picker. */
export function useFlowKanbanPickerBoards({ open, department, campaignBoards, flowData }) {
  const [departmentBoards, setDepartmentBoards] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !department) {
      setDepartmentBoards([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    fetch(internalBoardsQuery({ department, forFlowPicker: true }), { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (cancelled) return;
        const data = unwrapData(body);
        setDepartmentBoards(Array.isArray(data?.boards) ? data.boards : []);
      })
      .catch(() => {
        if (!cancelled) setDepartmentBoards([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, department]);

  const boards = useMemo(
    () => getFlowKanbanPickerBoards(campaignBoards, departmentBoards, flowData),
    [campaignBoards, departmentBoards, flowData]
  );

  return { boards, loading };
}
