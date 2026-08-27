import { personKey } from '@/lib/appdev';

/** Assignee, creator, and meeting attendees — deduped, non-empty display names. */
export function meetingNotificationRecipients(task) {
  const names = [];
  const seen = new Set();
  const add = (name) => {
    const trimmed = String(name || '').trim();
    const key = personKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  };

  add(task?.assignee);
  add(task?.created_by);

  if (Array.isArray(task?.meeting_attendees)) {
    for (const attendee of task.meeting_attendees) add(attendee);
  }

  return names;
}
