import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function CampaignsPage({ searchParams }) {
  return <InternalDepartmentLoader departmentId="campaigns" searchParams={searchParams} />;
}
