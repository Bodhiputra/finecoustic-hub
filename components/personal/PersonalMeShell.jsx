'use client';

import InternalDepartment from '@/components/internal/InternalDepartment';

/** Stable personal workspace shell — stays mounted while /me search params change. */
export default function PersonalMeShell({ authEnabled, workspace }) {
  return (
    <InternalDepartment
      departmentId="personal"
      authEnabled={authEnabled}
      initialMe={workspace.hubMe}
      initialTasks={workspace.tasks}
      initialTasksFilterKey={workspace.tasksFilterKey}
      initialTasksLoadError={workspace.tasksLoadError}
      initialPersonalJots={workspace.personalJots}
      initialPersonalBoards={workspace.personalBoards}
      initialTeamMembers={workspace.teamMembers}
      initialTeamMembersReady
    />
  );
}
