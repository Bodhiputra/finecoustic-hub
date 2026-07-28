import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function ProductsPage({ searchParams }) {
  return <InternalDepartmentLoader departmentId="products" searchParams={searchParams} />;
}
