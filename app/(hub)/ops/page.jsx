import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function OpsPage({ searchParams }) {
  return (
    <InternalDepartmentLoader departmentId="operations" searchParams={searchParams} />
  );
}
