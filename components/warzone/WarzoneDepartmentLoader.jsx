import { Suspense } from 'react';
import WarzoneDepartment from '@/components/warzone/WarzoneDepartment';
import DepartmentRouteLoading from '@/components/DepartmentRouteLoading';
import { isHubAuthEnabled } from '@/lib/auth';
import { loadDepartmentPage } from '@/lib/warzone-page-data';

/**
 * Server loader — parallel data fetch, passes initialTasks to client (REST for mutations).
 */
export default async function WarzoneDepartmentLoader({
  departmentId,
  searchParams,
}) {
  const { sp, tasks, opsData, marketingRows } = await loadDepartmentPage({
    departmentId,
    searchParams,
  });

  return (
    <Suspense fallback={<DepartmentRouteLoading departmentId={departmentId} />}>
      <WarzoneDepartment
        departmentId={departmentId}
        authEnabled={isHubAuthEnabled()}
        initialBucket={sp?.view || ''}
        initialTool={sp?.tool || ''}
        initialTasks={tasks}
        opsData={opsData}
        marketingRows={marketingRows}
      />
    </Suspense>
  );
}
