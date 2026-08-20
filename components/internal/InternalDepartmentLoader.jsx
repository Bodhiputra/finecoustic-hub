import { Suspense } from 'react';
import InternalDepartment from '@/components/internal/InternalDepartment';
import DepartmentRouteLoading from '@/components/DepartmentRouteLoading';
import { isHubAuthEnabled } from '@/lib/auth';
import { loadDepartmentPage } from '@/lib/internal-page-data';
import { requireDepartmentPageAccess } from '@/lib/hub-page-access';
import { resolveHubActor } from '@/lib/hub-actor';
import { redirect } from 'next/navigation';
import {
  loadDepartmentSidebarBoards,
  loadPersonalSidebarBoards,
} from '@/lib/page-loaders/sidebar';
import { loadHubTeamMembers, resolveDepartmentLoaderScope } from '@/lib/page-loaders/hub-shell';
import { PERSONAL_DEPARTMENT_ID } from '@/lib/internal';

async function resolveDepartmentLoaderActor(departmentId) {
  if (departmentId === 'all') {
    const actor = await resolveHubActor();
    if (!actor.ok) redirect('/');
    return actor;
  }
  return requireDepartmentPageAccess(departmentId);
}

/**
 * Server loader — one auth resolve, parallel sidebar + page data.
 */
export default async function InternalDepartmentLoader({
  departmentId,
  searchParams,
  fixedTool = '',
}) {
  const actor = await resolveDepartmentLoaderActor(departmentId);
  const { needsSidebarBoards, needsTeamMembers } = await resolveDepartmentLoaderScope(
    departmentId,
    searchParams,
    fixedTool
  );

  const sidebarPromise = needsSidebarBoards
    ? loadDepartmentSidebarBoards(departmentId, actor)
    : Promise.resolve([]);
  const personalSidebarPromise = departmentId === PERSONAL_DEPARTMENT_ID
    ? loadPersonalSidebarBoards(actor)
    : Promise.resolve([]);
  const teamMembersPromise = needsTeamMembers ? loadHubTeamMembers() : Promise.resolve([]);

  const [pageData, deptBoards, personalBoards, teamMembers] = await Promise.all([
    loadDepartmentPage({
      departmentId,
      searchParams,
      fixedTool,
      actor,
    }),
    sidebarPromise,
    personalSidebarPromise,
    teamMembersPromise,
  ]);

  const {
    sp,
    tasks,
    tasksFilterKey,
    tasksLoadError,
    opsData,
    shopifyConfigured,
    shopifySnapshot,
    marketingRows,
    campaigns,
    board,
    campaign,
    products,
    productDetail,
    kolPool,
    expenses,
    hubMe,
    personalJots,
    departmentJots,
  } = pageData;

  return (
    <Suspense fallback={<DepartmentRouteLoading departmentId={departmentId} />}>
      <InternalDepartment
        departmentId={departmentId}
        authEnabled={isHubAuthEnabled()}
        initialMe={hubMe}
        initialBucket={sp?.view || ''}
        initialTool={fixedTool || sp?.tool || ''}
        initialTasks={tasks}
        initialTasksFilterKey={tasksFilterKey}
        initialTasksLoadError={tasksLoadError}
        initialDeptBoards={deptBoards}
        initialPersonalBoards={personalBoards}
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
        initialPersonalJots={personalJots || []}
        initialDepartmentJots={departmentJots || []}
        initialExpenses={expenses}
        initialTeamMembers={teamMembers}
        initialTeamMembersReady
      />
    </Suspense>
  );
}
