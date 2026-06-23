import HubHome from '@/components/HubHome';
import HubLogin from '@/components/HubLogin';
import { isHubAuthEnabled, isHubAuthenticated } from '@/lib/auth';

export default async function HomePage() {
  if (!isHubAuthEnabled()) {
    return <HubHome authEnabled={false} />;
  }

  const authed = await isHubAuthenticated();
  if (!authed) {
    return <HubLogin />;
  }

  return <HubHome authEnabled />;
}
