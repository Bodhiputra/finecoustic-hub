import WarzoneDepartmentLoader from '@/components/warzone/WarzoneDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function MarketingPage({ searchParams }) {
  return (
    <WarzoneDepartmentLoader departmentId="marketing" searchParams={searchParams} />
  );
}
