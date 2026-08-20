import CampaignsDeptShell from '@/components/campaigns/CampaignsDeptShell';
import { HubDepartmentLayout } from '@/lib/page-loaders/department-layout';
import { loadCampaignsWorkspaceData } from '@/lib/page-loaders/campaigns-workspace';

export const dynamic = 'force-dynamic';

/** Campaign flow/board workspace — one server load; ?flow= / ?board= stay client-side. */
export default async function CampaignsLayout() {
  return HubDepartmentLayout({
    departmentId: 'campaigns',
    loadWorkspace: loadCampaignsWorkspaceData,
    Shell: CampaignsDeptShell,
  });
}
