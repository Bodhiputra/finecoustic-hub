import WarzoneDepartmentLoader from '@/components/warzone/WarzoneDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function CreativesPage({ searchParams }) {
  return <WarzoneDepartmentLoader departmentId="creatives" searchParams={searchParams} />;
}
