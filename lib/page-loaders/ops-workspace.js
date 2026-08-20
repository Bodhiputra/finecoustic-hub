import { getOpsData } from '@/lib/data';
import { listExpenses } from '@/lib/hub-expenses';
import { requireDepartmentPageAccess } from '@/lib/hub-page-access';
import { hubMeFromActor } from '@/lib/personal-hub-data';
import { isShopifyInventoryConfigured } from '@/lib/shopify-inventory';
import { readShopifySnapshot } from '@/lib/shopify-snapshot';
import { loadDepartmentSidebarBoards } from '@/lib/page-loaders/sidebar';

/** One server load for Ops — tool switches via ?tool= stay client-side. */
export async function loadOpsWorkspaceData() {
  const actor = await requireDepartmentPageAccess('operations');
  const hubMe = hubMeFromActor(actor);

  const [opsData, expenses, deptBoards] = await Promise.all([
    getOpsData().catch(err => {
      console.error('[loadOpsWorkspaceData] opsData', err);
      return null;
    }),
    listExpenses().catch(err => {
      console.error('[loadOpsWorkspaceData] expenses', err);
      return [];
    }),
    loadDepartmentSidebarBoards('operations', actor).catch(err => {
      console.error('[loadOpsWorkspaceData] sidebar boards', err);
      return [];
    }),
  ]);

  return {
    hubMe,
    opsData,
    expenses,
    shopifyConfigured: isShopifyInventoryConfigured(),
    shopifySnapshot: readShopifySnapshot(),
    deptBoards,
  };
}
