import { redirect } from 'next/navigation';
import { resolveHubActor } from '@/lib/hub-actor';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { loadInternalTasksForPage } from '@/lib/internal-page-data';
import { loadHubTeamMembers } from '@/lib/page-loaders/hub-shell';

/** One server load for All tasks — ?view= / ?people= switches stay client-side. */
export async function loadAllTasksWorkspaceData() {
  const actor = await resolveHubActor();
  if (!actor.ok) redirect('/');

  const hubMe = hubMeFromActor(actor);

  const [taskBundle, teamMembers] = await Promise.all([
    loadInternalTasksForPage({ departmentId: 'all', actor }),
    loadHubTeamMembers(),
  ]);

  return {
    hubMe,
    tasks: taskBundle.tasks,
    tasksFilterKey: taskBundle.tasksFilterKey,
    tasksLoadError: taskBundle.loadError || null,
    teamMembers,
  };
}
