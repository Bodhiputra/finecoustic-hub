import { requireHubActor } from '@/lib/hub-actor';
import { restError, restOk, restUnauthorized } from '@/lib/api/rest';
import {
  countHubUnreadForUser,
  listHubNotificationsForUser,
  markAllHubNotificationsRead,
  markHubNotificationRead,
} from '@/lib/hub-notifications';
import { processDueReminders } from '@/lib/hub-reminders';
import { processScheduleAlerts } from '@/lib/hub-schedule-alerts';

let lastScheduleAlertRun = 0;
const SCHEDULE_ALERT_THROTTLE_MS = 14 * 60 * 1000;

async function maybeProcessScheduleAlerts() {
  const now = Date.now();
  if (now - lastScheduleAlertRun < SCHEDULE_ALERT_THROTTLE_MS) return;
  lastScheduleAlertRun = now;
  try {
    await processScheduleAlerts();
  } catch (err) {
    console.error('[maybeProcessScheduleAlerts]', err);
  }
}

export async function getHubNotifications() {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  try {
    await maybeProcessScheduleAlerts();
    await processDueReminders(actor.displayName);

    const [items, unread] = await Promise.all([
      listHubNotificationsForUser(actor.displayName),
      countHubUnreadForUser(actor.displayName),
    ]);

    return restOk({ items, unread });
  } catch (err) {
    console.error('[getHubNotifications]', err);
    return restOk({ items: [], unread: 0 });
  }
}

export async function patchHubNotifications(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const body = await request.json().catch(() => ({}));

  if (body?.markAll) {
    const marked = await markAllHubNotificationsRead(actor.displayName);
    const unread = await countHubUnreadForUser(actor.displayName);
    return restOk({ marked, unread });
  }

  const id = String(body?.id || '').trim();
  if (!id) return restError('id_required', 400);

  await markHubNotificationRead(id, actor.displayName);
  const unread = await countHubUnreadForUser(actor.displayName);
  return restOk({ unread });
}
