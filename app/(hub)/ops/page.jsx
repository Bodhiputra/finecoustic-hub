import WarzoneDepartmentLoader from '@/components/warzone/WarzoneDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function OpsPage({ searchParams }) {
  return (
    <WarzoneDepartmentLoader departmentId="operations" searchParams={searchParams} />
  );
}
