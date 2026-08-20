'use client';

import InternalDepartment from '@/components/internal/InternalDepartment';

/** Stable products shell — ?product= / ?tab= switches without re-running the server loader. */
export default function ProductsDeptShell({ authEnabled, workspace }) {
  return (
    <InternalDepartment
      departmentId="products"
      authEnabled={authEnabled}
      initialMe={workspace.hubMe}
      initialProducts={workspace.products}
      initialProductDetail={workspace.productDetail}
      initialDeptBoards={workspace.deptBoards}
    />
  );
}
