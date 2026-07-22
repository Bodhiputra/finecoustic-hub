import WarzoneDepartmentLoader from '@/components/warzone/WarzoneDepartmentLoader';

export const dynamic = 'force-dynamic';

export default function ProductsPage({ searchParams }) {
  return <WarzoneDepartmentLoader departmentId="products" searchParams={searchParams} />;
}
