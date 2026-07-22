import HubAdminUsers from '@/components/HubAdminUsers';
import HubLogin from '@/components/HubLogin';
import { isHubAuthEnabled, isHubAuthenticated } from '@/lib/auth';
import { resolveHubActor } from '@/lib/hub-actor';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function HubAdminPage() {
  if (!isHubAuthEnabled()) return <HubAdminUsers />;
  const authed = await isHubAuthenticated();
  if (!authed) return <HubLogin />;
  const actor = await resolveHubActor();
  if (!actor.ok || !actor.isManager) redirect('/me');
  return <HubAdminUsers />;
}
