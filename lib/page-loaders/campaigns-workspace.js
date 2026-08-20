import { redirect } from 'next/navigation';
import { resolveHubActor } from '@/lib/hub-actor';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { listCampaigns } from '@/lib/internal-campaigns-data';
import { loadHubTeamMembers } from '@/lib/page-loaders/hub-shell';

/** One server load for /campaigns flow & board workspace — query switches stay client-side. */
export async function loadCampaignsWorkspaceData() {
  const actor = await resolveHubActor();
  if (!actor.ok) redirect('/');

  const hubMe = hubMeFromActor(actor);

  const [campaigns, teamMembers] = await Promise.all([
    listCampaigns().catch(err => {
      console.error('[loadCampaignsWorkspaceData] campaigns', err);
      return [];
    }),
    loadHubTeamMembers(),
  ]);

  return {
    hubMe,
    campaigns,
    teamMembers,
  };
}
