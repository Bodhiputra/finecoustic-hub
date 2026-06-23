import AppdevBoard from '@/components/AppdevBoard';
import AppdevAuthForm from '@/components/AppdevAuthForm';
import { getAppdevData } from '@/lib/appdev-data';
import { readAppdevDisplayNameFromCookies } from '@/lib/appdev-actor';
import { isAppdevAuthEnabled, isAppdevAuthenticated } from '@/lib/auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function AppdevLogin() {
  return <AppdevAuthForm defaultRedirect="/appdev" />;
}

export default async function AppdevPage() {
  if (!isAppdevAuthEnabled()) {
    const initialData = await getAppdevData().catch(() => null);
    return <AppdevBoard initialData={initialData} />;
  }

  const authed = await isAppdevAuthenticated();
  if (!authed) {
    return <AppdevLogin />;
  }

  const cookieStore = await cookies();
  const displayName = await readAppdevDisplayNameFromCookies(cookieStore);

  // Old sessions without a signed name — send back to full login (name + password).
  if (!displayName) {
    return <AppdevLogin />;
  }

  const initialData = await getAppdevData().catch(() => null);
  return <AppdevBoard initialData={initialData} />;
}
