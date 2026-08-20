import CreativesDeptShell from '@/components/creatives/CreativesDeptShell';
import { HubDepartmentLayout } from '@/lib/page-loaders/department-layout';
import { loadCreativesWorkspaceData } from '@/lib/page-loaders/creatives-workspace';

export const dynamic = 'force-dynamic';

/** Creatives realm — one server load; ?board= switches stay client-side. */
export default async function CreativesLayout() {
  return HubDepartmentLayout({
    departmentId: 'creatives',
    loadWorkspace: loadCreativesWorkspaceData,
    Shell: CreativesDeptShell,
  });
}
