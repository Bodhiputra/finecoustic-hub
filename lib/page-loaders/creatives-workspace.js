import { requireDepartmentPageAccess } from '@/lib/hub-page-access';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { loadInternalTasksForPage } from '@/lib/internal-page-data';
import { loadDepartmentSidebarBoards } from '@/lib/page-loaders/sidebar';
import { loadHubTeamMembers } from '@/lib/page-loaders/hub-shell';

/** One server load for Creatives — ?board= switches stay client-side. */
export async function loadCreativesWorkspaceData() {
  const actor = await requireDepartmentPageAccess('creatives');
  const hubMe = hubMeFromActor(actor);

  const [taskBundle, deptBoards, teamMembers] = await Promise.all([
    loadInternalTasksForPage({ departmentId: 'creatives', actor }),
    loadDepartmentSidebarBoards('creatives', actor).catch(err => {
      console.error('[loadCreativesWorkspaceData] sidebar boards', err);
      return [];
    }),
    loadHubTeamMembers(),
  ]);

  return {
    hubMe,
    tasks: taskBundle.tasks,
    tasksFilterKey: taskBundle.tasksFilterKey,
    tasksLoadError: taskBundle.loadError || null,
    deptBoards,
    teamMembers,
  };
}
