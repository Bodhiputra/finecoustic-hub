import { getHubNotifications, patchHubNotifications } from '@/lib/api/hub-notifications-handlers';

export async function GET() {
  return getHubNotifications();
}

export async function PATCH(request) {
  return patchHubNotifications(request);
}
