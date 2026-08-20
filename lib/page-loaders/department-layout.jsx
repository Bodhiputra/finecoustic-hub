import { Suspense } from 'react';
import DepartmentRouteLoading from '@/components/DepartmentRouteLoading';
import { isHubAuthEnabled } from '@/lib/auth';

/**
 * Shared department layout — auth is enforced in middleware + workspace loaders.
 * Skips redundant isHubAuthenticated() before every workspace fetch.
 */
export async function HubDepartmentLayout({ departmentId, loadWorkspace, Shell }) {
  const authEnabled = isHubAuthEnabled();
  const workspace = await loadWorkspace();

  return (
    <Suspense fallback={<DepartmentRouteLoading departmentId={departmentId} />}>
      <Shell authEnabled={authEnabled} workspace={workspace} />
    </Suspense>
  );
}
