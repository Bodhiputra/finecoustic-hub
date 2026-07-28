import InternalHome from '@/components/InternalHome';
import HubLogin from '@/components/HubLogin';
import { isHubAuthEnabled, isHubAuthenticated } from '@/lib/auth';
import { loadInternalTasksForPage } from '@/lib/internal-page-data';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (!isHubAuthEnabled()) {
    return <InternalHome authEnabled={false} initialTasks={[]} />;
  }

  const authed = await isHubAuthenticated();
  if (!authed) {
    return <HubLogin />;
  }

  const { tasks, displayName } = await loadInternalTasksForPage({});

  return (
    <InternalHome
      authEnabled
      initialTasks={tasks}
      displayName={displayName || ''}
    />
  );
}
