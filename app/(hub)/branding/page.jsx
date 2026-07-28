import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function BrandingPage({ searchParams }) {
  return <InternalDepartmentLoader departmentId="branding" searchParams={searchParams} />;
}
