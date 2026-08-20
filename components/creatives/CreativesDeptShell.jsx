'use client';

import InternalDepartment from '@/components/internal/InternalDepartment';

/** Stable creatives shell — ?board= switches without re-running the server loader. */
export default function CreativesDeptShell({ authEnabled, workspace }) {
  return (
    <InternalDepartment
      departmentId="creatives"
      authEnabled={authEnabled}
      initialMe={workspace.hubMe}
      initialTasks={workspace.tasks}
      initialTasksFilterKey={workspace.tasksFilterKey}
      initialTasksLoadError={workspace.tasksLoadError}
      initialDeptBoards={workspace.deptBoards}
      initialTeamMembers={workspace.teamMembers}
      initialTeamMembersReady
    />
  );
}
