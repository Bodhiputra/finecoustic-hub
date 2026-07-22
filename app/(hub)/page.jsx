import WarzoneHome from '@/components/WarzoneHome';
import HubLogin from '@/components/HubLogin';
import { isHubAuthEnabled, isHubAuthenticated } from '@/lib/auth';
import { loadWarzoneTasksForPage } from '@/lib/warzone-page-data';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (!isHubAuthEnabled()) {
    return <WarzoneHome authEnabled={false} initialTasks={[]} />;
  }

  const authed = await isHubAuthenticated();
  if (!authed) {
    return <HubLogin />;
  }

  const { tasks, displayName } = await loadWarzoneTasksForPage({});

  return (
    <WarzoneHome
      authEnabled
      initialTasks={tasks}
      displayName={displayName || ''}
    />
  );
}
