import { requireHubActor } from '@/lib/hub-actor';
import { getInternalTasksRevision } from '@/lib/internal-data';
import { restOk, restUnauthorized } from '@/lib/api/rest';

export async function getInternalTasksRevisionHandler(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const { searchParams } = new URL(request.url);
  const department = searchParams.get('department') || '';
  const board_id = searchParams.get('board_id') || '';
  const campaign_id = searchParams.get('campaign_id') || '';
  const flow_only = searchParams.get('flow_only') === '1';
  const hub_home = searchParams.get('hub_home') === '1';

  const revision = await getInternalTasksRevision({
    department: department || undefined,
    board_id: board_id || undefined,
    campaign_id: campaign_id || undefined,
    flow_only: flow_only || undefined,
    hub_home: hub_home || undefined,
  });

  return restOk({ revision });
}
