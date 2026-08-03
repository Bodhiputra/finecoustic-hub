import { redirect } from 'next/navigation';
import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';
import { resolveHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }) {
  const actor = await resolveHubActor();
  if (!actor.ok || !canAccessDepartment(actor, 'products')) {
    redirect('/me');
  }

  return <InternalDepartmentLoader departmentId="products" searchParams={searchParams} />;
}
