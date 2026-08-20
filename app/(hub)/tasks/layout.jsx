import AllTasksDeptShell from '@/components/tasks/AllTasksDeptShell';
import { HubDepartmentLayout } from '@/lib/page-loaders/department-layout';
import { loadAllTasksWorkspaceData } from '@/lib/page-loaders/all-tasks-workspace';

export const dynamic = 'force-dynamic';

/** All tasks realm — one server load; filter query changes stay client-side. */
export default async function AllTasksLayout() {
  return HubDepartmentLayout({
    departmentId: 'all',
    loadWorkspace: loadAllTasksWorkspaceData,
    Shell: AllTasksDeptShell,
  });
}
