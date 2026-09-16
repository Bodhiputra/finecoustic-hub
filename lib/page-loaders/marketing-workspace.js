import { headers } from 'next/headers';
import { requireDepartmentPageAccess } from '@/lib/hub-page-access';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { loadDepartmentSidebarBoards } from '@/lib/page-loaders/sidebar';
import { loadMarketingTeamMembers } from '@/lib/page-loaders/hub-shell';
import { marketingToolFromPathname } from '@/lib/marketing-routes';
import {
  loadMarketingKolOutreachPage,
  loadMarketingKolPoolPage,
  loadMarketingPreorderSurveyPage,
} from '@/lib/page-loaders/marketing';

/** Marketing workspace — load heavy KOL/outreach data only for tools that need it. */
export async function loadMarketingWorkspaceData() {
  const actor = await requireDepartmentPageAccess('marketing');
  const hubMe = hubMeFromActor(actor);
  const pathname = (await headers()).get('x-hub-pathname') || '';
  const tool = marketingToolFromPathname(pathname) || 'kol-pool';

  const needsOutreach = tool === 'kol-outreach';
  const needsPoolMeta = ['kol-pool', 'kol-outreach', 'kol-tracking'].includes(tool);

  const [kolPoolLoaded, deptBoards, teamMembers] = await Promise.all([
    needsPoolMeta ? loadMarketingKolPoolPage(actor) : Promise.resolve({ kolPool: null }),
    loadDepartmentSidebarBoards('marketing', actor).catch(err => {
      console.error('[loadMarketingWorkspaceData] sidebar boards', err);
      return [];
    }),
    needsOutreach ? loadMarketingTeamMembers() : Promise.resolve([]),
  ]);

  const [outreachLoaded, surveyLoaded] = await Promise.all([
    needsOutreach
      ? loadMarketingKolOutreachPage(actor)
      : Promise.resolve({
          tasks: [],
          tasksFilterKey: null,
          tasksLoadError: null,
          kolPool: null,
        }),
    tool === 'preorder-survey'
      ? loadMarketingPreorderSurveyPage()
      : Promise.resolve({ marketingRows: [] }),
  ]);

  const kolPool =
    needsOutreach && outreachLoaded.kolPool
      ? outreachLoaded.kolPool
      : kolPoolLoaded.kolPool;

  return {
    hubMe,
    kolPool,
    marketingRows: surveyLoaded.marketingRows,
    outreachTasks: outreachLoaded.tasks,
    outreachTasksFilterKey: outreachLoaded.tasksFilterKey,
    outreachTasksLoadError: outreachLoaded.tasksLoadError || null,
    deptBoards,
    teamMembers,
  };
}
