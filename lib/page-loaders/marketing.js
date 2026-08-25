import { listTasksForActor } from '@/lib/internal-data';
import { internalTasksFilterKey } from '@/lib/internal-tasks-filters';
import { loadKolPoolForPage } from '@/lib/api/kol-pool-handlers';
import { ensureKolOutreachBoard } from '@/lib/kol-outreach-board';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/kol-outreach-shared';
import { listPreorderSurveyResponses } from '@/lib/preorder-survey';

const EMPTY_KOL_POOL = { records: [], meta: null, counts: {}, configured: false, total: 0 };

/** KOL pool — single REST-backed dataset, no task board. */
export async function loadMarketingKolPoolPage(actor) {
  if (!actor?.ok) {
    return { kolPool: EMPTY_KOL_POOL };
  }
  try {
    const kolPool = await loadKolPoolForPage();
    return { kolPool };
  } catch (err) {
    console.error('[loadMarketingKolPoolPage]', err);
    return { kolPool: EMPTY_KOL_POOL };
  }
}

/** KOL outreach — board tasks; pool data optional when workspace already loaded it. */
export async function loadMarketingKolOutreachPage(actor, { kolPool = null } = {}) {
  if (!actor?.ok) {
    return {
      tasks: [],
      tasksFilterKey: null,
      tasksLoadError: null,
      kolPool: EMPTY_KOL_POOL,
    };
  }

  try {
    await ensureKolOutreachBoard(actor);

    const tasksFilterKey = internalTasksFilterKey({
      departmentId: 'marketing',
      boardId: KOL_OUTREACH_BOARD_ID,
    });

    const [tasks, poolLoaded] = await Promise.all([
      listTasksForActor(actor, {
        department: 'marketing',
        board_id: KOL_OUTREACH_BOARD_ID,
      }),
      kolPool ? Promise.resolve(kolPool) : loadKolPoolForPage(),
    ]);

    return {
      tasks,
      tasksFilterKey,
      tasksLoadError: null,
      kolPool: poolLoaded,
    };
  } catch (err) {
    console.error('[loadMarketingKolOutreachPage]', err);
    return {
      tasks: [],
      tasksFilterKey: null,
      tasksLoadError: 'tasks_unavailable',
      kolPool: EMPTY_KOL_POOL,
    };
  }
}

/** Preorder survey responses. */
export async function loadMarketingPreorderSurveyPage() {
  try {
    const marketingRows = await listPreorderSurveyResponses({ limit: 500 });
    return { marketingRows };
  } catch (err) {
    console.error('[loadMarketingPreorderSurveyPage]', err);
    return { marketingRows: [] };
  }
}
