import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function MarketingPage({ searchParams }) {
  return (
    <InternalDepartmentLoader departmentId="marketing" searchParams={searchParams} />
  );
}
