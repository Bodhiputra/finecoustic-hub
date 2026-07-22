import PersonalHub from '@/components/PersonalHub';
import HubLogin from '@/components/HubLogin';
import { isHubAuthEnabled, isHubAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  if (!isHubAuthEnabled()) {
    return <PersonalHub authEnabled={false} />;
  }
  const authed = await isHubAuthenticated();
  if (!authed) return <HubLogin />;
  return <PersonalHub authEnabled />;
}
