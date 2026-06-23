import OpsHub from '@/components/OpsHub';
import { isHubAuthEnabled } from '@/lib/auth';
import { getOpsData } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const data = await getOpsData();
  return <OpsHub initialData={data} authEnabled={isHubAuthEnabled()} view="stock" />;
}
