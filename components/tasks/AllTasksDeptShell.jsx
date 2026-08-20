'use client';

import InternalDepartment from '@/components/internal/InternalDepartment';

/** Stable all-tasks shell — filter query changes without re-running the server loader. */
export default function AllTasksDeptShell({ authEnabled, workspace }) {
  return (
    <InternalDepartment
      departmentId="all"
      authEnabled={authEnabled}
      initialMe={workspace.hubMe}
      initialTasks={workspace.tasks}
      initialTasksFilterKey={workspace.tasksFilterKey}
      initialTasksLoadError={workspace.tasksLoadError}
      initialTeamMembers={workspace.teamMembers}
      initialTeamMembersReady
    />
  );
}
