import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function CreativesPage({ searchParams }) {
  return <InternalDepartmentLoader departmentId="creatives" searchParams={searchParams} />;
}
