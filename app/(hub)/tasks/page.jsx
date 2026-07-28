import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function AllTasksPage({ searchParams }) {
  return <InternalDepartmentLoader departmentId="all" searchParams={searchParams} />;
}
