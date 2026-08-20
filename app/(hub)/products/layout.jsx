import ProductsDeptShell from '@/components/products/ProductsDeptShell';
import { HubDepartmentLayout } from '@/lib/page-loaders/department-layout';
import { loadProductsWorkspaceData } from '@/lib/page-loaders/products-workspace';

export const dynamic = 'force-dynamic';

/** Products realm — one server load; ?product= / ?tab= switches stay client-side. */
export default async function ProductsLayout() {
  return HubDepartmentLayout({
    departmentId: 'products',
    loadWorkspace: loadProductsWorkspaceData,
    Shell: ProductsDeptShell,
  });
}
