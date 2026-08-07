import { requireHubActor } from '@/lib/hub-actor';
import { listActiveTeamMemberNames } from '@/lib/hub-users';
import { restOk, restUnauthorized } from '@/lib/api/rest';

export async function GET() {
  try {
    await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const members = await listActiveTeamMemberNames();
  return restOk({ members });
}
