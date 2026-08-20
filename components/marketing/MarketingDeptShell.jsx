'use client';

import InternalDepartment from '@/components/internal/InternalDepartment';

/** Stable marketing shell — stays mounted across /marketing/* tool routes. */
export default function MarketingDeptShell({ authEnabled, workspace }) {
  return (
    <InternalDepartment
      departmentId="marketing"
      authEnabled={authEnabled}
      initialMe={workspace.hubMe}
      initialTasks={workspace.outreachTasks}
      initialTasksFilterKey={workspace.outreachTasksFilterKey}
      initialTasksLoadError={workspace.outreachTasksLoadError}
      marketingRows={workspace.marketingRows}
      initialKolPool={workspace.kolPool}
      initialDeptBoards={workspace.deptBoards}
      initialTeamMembers={workspace.teamMembers}
      initialTeamMembersReady
    />
  );
}
