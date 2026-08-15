import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import {
  createReminder,
  deleteReminder,
  listRemindersForUser,
  processDueReminders,
} from '@/lib/hub-reminders';
import {
  restError,
  restForbidden,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function requireHubAccess(actor) {
  if (actor.mustChangePassword) return restForbidden('must_change_password');
  return null;
}

export async function getReminders() {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireHubAccess(actor);
  if (denied) return denied;

  await processDueReminders(actor.displayName);
  const reminders = await listRemindersForUser(actor.displayName);
  return restOk({ reminders, count: reminders.length });
}

export async function postReminder(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireHubAccess(actor);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  try {
    const reminder = await createReminder({
      userName: actor.displayName,
      title: body.title,
      dueAt: body.due_at || body.dueAt,
      entityType: body.entity_type,
      entityId: body.entity_id,
    });
    return restOk({ reminder });
  } catch (e) {
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function deleteReminderById(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireHubAccess(actor);
  if (denied) return denied;

  const { id } = await params;
  const ok = await deleteReminder(id, actor.displayName);
  if (!ok) return restError('not_found', 404);
  return restOk({ deleted: true });
}
