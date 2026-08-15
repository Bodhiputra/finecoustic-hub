import { getReminders, postReminder } from '@/lib/api/reminders-handlers';

export async function GET() {
  return getReminders();
}

export async function POST(request) {
  return postReminder(request);
}
