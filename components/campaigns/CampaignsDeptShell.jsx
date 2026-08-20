'use client';

import InternalDepartment from '@/components/internal/InternalDepartment';

/** Stable campaigns workspace shell — ?flow= / ?board= without server reload. */
export default function CampaignsDeptShell({ authEnabled, workspace }) {
  return (
    <InternalDepartment
      departmentId="campaigns"
      authEnabled={authEnabled}
      initialMe={workspace.hubMe}
      initialCampaigns={workspace.campaigns}
      initialTeamMembers={workspace.teamMembers}
      initialTeamMembersReady
    />
  );
}
