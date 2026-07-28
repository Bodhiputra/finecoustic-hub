import { Suspense } from 'react';
import InternalDepartment from '@/components/internal/InternalDepartment';
import DepartmentRouteLoading from '@/components/DepartmentRouteLoading';
import { isHubAuthEnabled } from '@/lib/auth';
import { loadDepartmentPage } from '@/lib/internal-page-data';

/**
 * Server loader — parallel data fetch, passes initialTasks to client (REST for mutations).
 */
export default async function InternalDepartmentLoader({
  departmentId,
  searchParams,
}) {
  const { sp, tasks, opsData, marketingRows, campaigns, board } = await loadDepartmentPage({
    departmentId,
    searchParams,
  });

  return (
    <Suspense fallback={<DepartmentRouteLoading departmentId={departmentId} />}>
      <InternalDepartment
        departmentId={departmentId}
        authEnabled={isHubAuthEnabled()}
        initialBucket={sp?.view || ''}
        initialTool={sp?.tool || ''}
        initialTasks={tasks}
        opsData={opsData}
        marketingRows={marketingRows}
        initialCampaigns={campaigns}
        initialBoard={board}
      />
    </Suspense>
  );
}
