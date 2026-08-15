import { deleteReminderById } from '@/lib/api/reminders-handlers';

export async function DELETE(request, context) {
  return deleteReminderById(request, context);
}
