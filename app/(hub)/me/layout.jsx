import PersonalMeShell from '@/components/personal/PersonalMeShell';
import { HubDepartmentLayout } from '@/lib/page-loaders/department-layout';
import { loadPersonalWorkspaceData } from '@/lib/internal-page-data';

export const dynamic = 'force-dynamic';

export default async function MeLayout() {
  return HubDepartmentLayout({
    departmentId: 'personal',
    loadWorkspace: loadPersonalWorkspaceData,
    Shell: PersonalMeShell,
  });
}
