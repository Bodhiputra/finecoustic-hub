import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import { listKolPoolRecords } from '@/lib/kol-pool-data';
import { buildWeibinWorkbook } from '@/lib/kol-weibin-export';
import { normalizeKolOutreachStatus, KOL_BOARD_PROP, isKolWeibinExportStatus } from '@/lib/kol-outreach-shared';
import { listKolOutreachTasksForAlerts } from '@/lib/internal-data';
import { restForbidden, restUnauthorized } from '@/lib/api/rest';

export async function GET(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  if (actor.mustChangePassword || !canAccessDepartment(actor, 'marketing')) {
    return restForbidden('department_forbidden');
  }

  const { searchParams } = new URL(request.url);
  const initiative = String(searchParams.get('initiative') || '').trim().toLowerCase();
  const taskIdsRaw = String(searchParams.get('task_ids') || '').trim();
  const taskIdSet = taskIdsRaw
    ? new Set(taskIdsRaw.split(',').map(id => id.trim()).filter(Boolean))
    : null;

  const [tasks, { records: poolRecords }] = await Promise.all([
    listKolOutreachTasksForAlerts(),
    listKolPoolRecords(),
  ]);

  let weibinTasks = tasks.filter(task => isKolWeibinExportStatus(task.status));
  if (taskIdSet?.size) {
    weibinTasks = weibinTasks.filter(task => taskIdSet.has(task.id));
  } else if (initiative) {
    weibinTasks = weibinTasks.filter(task => {
      const raw = String(task?.custom_values?.[KOL_BOARD_PROP.initiative] || '').trim().toLowerCase();
      return raw === initiative;
    });
  }

  if (!weibinTasks.length) {
    return new Response(JSON.stringify({ error: 'weibin_export_empty' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { buffer, filename } = await buildWeibinWorkbook(weibinTasks, poolRecords);

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
      'Cache-Control': 'no-store',
    },
  });
}
