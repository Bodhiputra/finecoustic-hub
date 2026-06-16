import OpsHub from '@/components/OpsHub';
import { isAuthEnabled } from '@/lib/auth';
import { getOpsData } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const data = await getOpsData();
  return <OpsHub initialData={data} authEnabled={isAuthEnabled()} view="stock" />;
}
