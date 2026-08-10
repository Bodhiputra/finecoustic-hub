import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function AboutFinecousticPage({ searchParams }) {
  return <InternalDepartmentLoader departmentId="finecoustic" searchParams={searchParams} />;
}
