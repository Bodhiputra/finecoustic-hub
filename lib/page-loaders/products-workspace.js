import { loadProductsForPage } from '@/lib/products-data';
import { requireDepartmentPageAccess } from '@/lib/hub-page-access';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { loadDepartmentSidebarBoards } from '@/lib/page-loaders/sidebar';

/** One server load for Products catalog — SKU/tab query changes stay client-side. */
export async function loadProductsWorkspaceData() {
  const actor = await requireDepartmentPageAccess('products');
  const hubMe = hubMeFromActor(actor);

  const [catalog, deptBoards] = await Promise.all([
    loadProductsForPage(actor, '').catch(err => {
      console.error('[loadProductsWorkspaceData] catalog', err);
      return { products: [], productDetail: null };
    }),
    loadDepartmentSidebarBoards('products', actor).catch(err => {
      console.error('[loadProductsWorkspaceData] sidebar boards', err);
      return [];
    }),
  ]);

  return {
    hubMe,
    products: catalog.products,
    productDetail: catalog.productDetail,
    deptBoards,
  };
}
