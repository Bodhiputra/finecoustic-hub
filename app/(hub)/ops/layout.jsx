import OpsDeptShell from '@/components/ops/OpsDeptShell';
import { HubDepartmentLayout } from '@/lib/page-loaders/department-layout';
import { loadOpsWorkspaceData } from '@/lib/page-loaders/ops-workspace';

export const dynamic = 'force-dynamic';

/** Ops realm — one server load; ?tool= switches stay client-side. */
export default async function OpsLayout() {
  return HubDepartmentLayout({
    departmentId: 'operations',
    loadWorkspace: loadOpsWorkspaceData,
    Shell: OpsDeptShell,
  });
}
