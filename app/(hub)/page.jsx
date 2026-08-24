import { Suspense } from 'react';
import InternalHome from '@/components/InternalHome';
import HubLogin from '@/components/HubLogin';
import { isHubAuthEnabled } from '@/lib/auth';
import { resolveHubActor } from '@/lib/hub-actor';
import { loadHomePageData } from '@/lib/internal-page-data';

export const dynamic = 'force-dynamic';

function HomeFallback() {
  return <div className="hub-main internal-main personal-hub-hint" style={{ padding: '2rem' }}>Loading…</div>;
}

/** Hub home shell — calendar + client-side ?campaigns=1 / ?wiki=1 tabs (no server reload on query change). */
export default async function HomePage() {
  if (!isHubAuthEnabled()) {
    return (
      <Suspense fallback={<HomeFallback />}>
        <InternalHome authEnabled={false} initialTasks={[]} />
      </Suspense>
    );
  }

  const actor = await resolveHubActor();
  if (!actor.ok) {
    return <HubLogin />;
  }

  const {
    displayName,
    initialProfile,
    tasks,
    tasksFilterKey,
    teamMembers,
    initialCampaigns,
    initialWikiPages,
  } = await loadHomePageData();

  return (
    <Suspense fallback={<HomeFallback />}>
      <InternalHome
        authEnabled
        initialProfile={initialProfile}
        initialTasks={tasks}
        initialTasksFilterKey={tasksFilterKey}
        initialTeamMembers={teamMembers}
        initialCampaigns={initialCampaigns}
        initialWikiPages={initialWikiPages}
        displayName={displayName || ''}
      />
    </Suspense>
  );
}
