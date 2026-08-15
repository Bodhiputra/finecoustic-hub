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
  const { sp, tasks, tasksFilterKey, opsData, shopifyConfigured, shopifySnapshot, marketingRows, campaigns, board, campaign, products, productDetail, kolPool, campaignKol, expenses, hubMe } =
    await loadDepartmentPage({
      departmentId,
      searchParams,
    });

  return (
    <Suspense fallback={<DepartmentRouteLoading departmentId={departmentId} />}>
      <InternalDepartment
        departmentId={departmentId}
        authEnabled={isHubAuthEnabled()}
        initialMe={hubMe}
        initialBucket={sp?.view || ''}
        initialTool={sp?.tool || ''}
        initialTasks={tasks}
        initialTasksFilterKey={tasksFilterKey}
        opsData={opsData}
        shopifyConfigured={shopifyConfigured}
        shopifySnapshot={shopifySnapshot}
        marketingRows={marketingRows}
        initialCampaigns={campaigns}
        initialBoard={board}
        initialCampaign={campaign}
        initialProducts={products}
        initialProductDetail={productDetail}
        initialKolPool={kolPool}
        initialCampaignKol={campaignKol}
        initialExpenses={expenses}
      />
    </Suspense>
  );
}
