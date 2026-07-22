import WarzoneDepartmentLoader from '@/components/warzone/WarzoneDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function BrandingPage({ searchParams }) {
  return <WarzoneDepartmentLoader departmentId="branding" searchParams={searchParams} />;
}
