import { processScheduleAlerts } from '@/lib/hub-schedule-alerts';
import { processKolOutreachAlerts } from '@/lib/kol-outreach-alerts';

function authorizeCron(request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

/** Vercel cron — deadline/meeting lead-time alerts + due manual reminders. */
export async function GET(request) {
  if (!authorizeCron(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const scheduleSent = await processScheduleAlerts();
    const kol = await processKolOutreachAlerts();
    return Response.json({ ok: true, scheduleSent, kol });
  } catch (err) {
    console.error('[cron/schedule-alerts]', err);
    return Response.json({ error: 'schedule_alerts_failed' }, { status: 500 });
  }
}

/** Optional manual reminder sweep per user is handled on bell fetch. */
export async function POST(request) {
  return GET(request);
}
