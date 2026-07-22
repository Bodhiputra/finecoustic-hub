import WarzoneDepartmentLoader from '@/components/warzone/WarzoneDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function AllTasksPage({ searchParams }) {
  return <WarzoneDepartmentLoader departmentId="all" searchParams={searchParams} />;
}
