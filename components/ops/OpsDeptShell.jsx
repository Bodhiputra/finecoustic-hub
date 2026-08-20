'use client';

import InternalDepartment from '@/components/internal/InternalDepartment';

/** Stable ops shell — ?tool= switches without re-running the server loader. */
export default function OpsDeptShell({ authEnabled, workspace }) {
  return (
    <InternalDepartment
      departmentId="operations"
      authEnabled={authEnabled}
      initialMe={workspace.hubMe}
      opsData={workspace.opsData}
      shopifyConfigured={workspace.shopifyConfigured}
      shopifySnapshot={workspace.shopifySnapshot}
      initialExpenses={workspace.expenses}
      initialDeptBoards={workspace.deptBoards}
    />
  );
}
