import PersonalHub from '@/components/PersonalHub';
import HubLogin from '@/components/HubLogin';
import { isHubAuthEnabled, isHubAuthenticated } from '@/lib/auth';
import { loadPersonalHubPage } from '@/lib/personal-hub-data';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  if (!isHubAuthEnabled()) {
    return <PersonalHub authEnabled={false} />;
  }
  const authed = await isHubAuthenticated();
  if (!authed) return <HubLogin />;
  const { profile, stats } = await loadPersonalHubPage();
  return <PersonalHub authEnabled initialProfile={profile} initialStats={stats} />;
}
