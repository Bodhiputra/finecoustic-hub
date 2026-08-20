import MarketingDeptShell from '@/components/marketing/MarketingDeptShell';
import { HubDepartmentLayout } from '@/lib/page-loaders/department-layout';
import { loadMarketingWorkspaceData } from '@/lib/page-loaders/marketing-workspace';

export const dynamic = 'force-dynamic';

/** Marketing realm — one server load; /marketing/* tool routes swap without refetching workspace data. */
export default async function MarketingLayout() {
  return HubDepartmentLayout({
    departmentId: 'marketing',
    loadWorkspace: loadMarketingWorkspaceData,
    Shell: MarketingDeptShell,
  });
}
