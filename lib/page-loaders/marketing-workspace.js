import { headers } from 'next/headers';
import { requireDepartmentPageAccess } from '@/lib/hub-page-access';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { loadDepartmentSidebarBoards } from '@/lib/page-loaders/sidebar';
import { loadHubTeamMembers } from '@/lib/page-loaders/hub-shell';
import { marketingToolFromPathname } from '@/lib/marketing-routes';
import {
  loadMarketingKolOutreachPage,
  loadMarketingKolPoolPage,
  loadMarketingPreorderSurveyPage,
} from '@/lib/page-loaders/marketing';

const EMPTY_OUTREACH = {
  tasks: [],
  tasksFilterKey: null,
  tasksLoadError: null,
};

/** One server load for Marketing — scoped to the active tool route when possible. */
export async function loadMarketingWorkspaceData() {
  const actor = await requireDepartmentPageAccess('marketing');
  const hubMe = hubMeFromActor(actor);
  const pathname = (await headers()).get('x-hub-pathname') || '';
  const tool = marketingToolFromPathname(pathname) || 'kol-pool';

  const [kolPoolLoaded, deptBoards, teamMembers] = await Promise.all([
    loadMarketingKolPoolPage(actor),
    loadDepartmentSidebarBoards('marketing', actor).catch(err => {
      console.error('[loadMarketingWorkspaceData] sidebar boards', err);
      return [];
    }),
    loadHubTeamMembers(),
  ]);

  const [outreachLoaded, surveyLoaded] = await Promise.all([
    tool === 'kol-outreach'
      ? loadMarketingKolOutreachPage(actor, { kolPool: kolPoolLoaded.kolPool })
      : Promise.resolve(EMPTY_OUTREACH),
    tool === 'preorder-survey'
      ? loadMarketingPreorderSurveyPage()
      : Promise.resolve({ marketingRows: [] }),
  ]);

  return {
    hubMe,
    kolPool: kolPoolLoaded.kolPool,
    marketingRows: surveyLoaded.marketingRows,
    outreachTasks: outreachLoaded.tasks,
    outreachTasksFilterKey: outreachLoaded.tasksFilterKey,
    outreachTasksLoadError: outreachLoaded.tasksLoadError || null,
    deptBoards,
    teamMembers,
  };
}
