import { requireDepartmentPageAccess } from '@/lib/hub-page-access';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { loadDepartmentSidebarBoards } from '@/lib/page-loaders/sidebar';
import { loadHubTeamMembers } from '@/lib/page-loaders/hub-shell';
import {
  loadMarketingKolOutreachPage,
  loadMarketingKolPoolPage,
  loadMarketingPreorderSurveyPage,
} from '@/lib/page-loaders/marketing';

/** One server load for all Marketing data tools — layout stays mounted across /marketing/* routes. */
export async function loadMarketingWorkspaceData() {
  const actor = await requireDepartmentPageAccess('marketing');
  const hubMe = hubMeFromActor(actor);

  const [kolPoolLoaded, outreachLoaded, surveyLoaded, deptBoards, teamMembers] = await Promise.all([
    loadMarketingKolPoolPage(actor),
    loadMarketingKolOutreachPage(actor),
    loadMarketingPreorderSurveyPage(),
    loadDepartmentSidebarBoards('marketing', actor).catch(err => {
      console.error('[loadMarketingWorkspaceData] sidebar boards', err);
      return [];
    }),
    loadHubTeamMembers(),
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
