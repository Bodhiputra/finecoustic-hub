import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import { countKolBySection, filterKolBySection, filterVisibleKolPool, KOL_POOL_SECTION_IDS } from '@/lib/kol-pool';
import { personKey } from '@/lib/appdev';
import { createHubNotification } from '@/lib/hub-notifications';
import {
  isKolPoolConfigured,
  listKolPoolRecords,
  syncKolPoolFromNotion,
  setKolPoolSyncStatus,
  createKolPoolRecord,
  updateKolPoolRecord,
} from '@/lib/kol-pool-data';
import {
  restError,
  restForbidden,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function requireMarketingAccess(actor) {
  if (actor.mustChangePassword) return restForbidden('must_change_password');
  if (!canAccessDepartment(actor, 'marketing')) return restForbidden('department_forbidden');
  return null;
}

export async function getKolPool(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') || 'masterlist';
  const safeSection = KOL_POOL_SECTION_IDS.includes(section) ? section : 'masterlist';

  const { records, meta } = await listKolPoolRecords();
  const visible = filterVisibleKolPool(records);
  const filtered = filterKolBySection(visible, safeSection);
  const counts = countKolBySection(visible);

  return restOk({
    records: filtered,
    meta,
    section: safeSection,
    counts,
    configured: isKolPoolConfigured(),
    total: visible.length,
  });
}

export async function postKolPoolSync(scheduleAfter) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  if (!isKolPoolConfigured()) {
    return restError('notion_not_configured', 503);
  }

  const { meta } = await listKolPoolRecords();
  if (meta.sync_status === 'syncing') {
    return restError('sync_in_progress', 409);
  }

  await setKolPoolSyncStatus('syncing', { last_error: '' });

  const runSync = async () => {
    try {
      const { records, meta: nextMeta } = await syncKolPoolFromNotion(actor.displayName);
      const visible = filterVisibleKolPool(records);
      try {
        await createHubNotification({
          recipientName: actor.displayName,
          type: 'kol_sync',
          entityType: 'kol_pool',
          title: String(visible.length),
          actorName: actor.displayName,
          payload: { record_count: visible.length, synced_total: records.length },
          dedupeKey: `kol_sync:${personKey(actor.displayName)}:${nextMeta.last_synced_at}`,
        });
      } catch {
        /* sync succeeded — notification is best-effort */
      }
    } catch {
      /* syncKolPoolFromNotion writes meta + last_error */
    }
  };

  if (typeof scheduleAfter === 'function') {
    scheduleAfter(runSync);
    return restOk({
      status: 'syncing',
      meta: { ...meta, sync_status: 'syncing', last_error: '' },
    });
  }

  try {
    await runSync();
    const { records, meta: nextMeta } = await listKolPoolRecords();
    const visible = filterVisibleKolPool(records);
    const counts = countKolBySection(visible);
    return restOk({
      records: visible,
      meta: nextMeta,
      counts,
      total: visible.length,
      configured: true,
    });
  } catch (e) {
    if (e.message === 'notion_not_configured') {
      return restError('notion_not_configured', 503);
    }
    if (e.status === 401 || e.status === 403) {
      return restError('notion_auth_failed', 502);
    }
    if (e.status === 404) {
      return restError('notion_database_not_found', 502);
    }
    return restError(e.message || 'notion_sync_failed', 502, {
      detail: e.detail || undefined,
    });
  }
}

export async function postKolPool(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  try {
    const record = await createKolPoolRecord(body);
    return restOk({ record });
  } catch (e) {
    if (e.status === 400) {
      if (e.message === 'channel_name_required') return restError('channel_name_required', 400);
      return restError(e.message, 400);
    }
    throw e;
  }
}

export async function loadKolPoolForPage() {
  const { records, meta } = await listKolPoolRecords();
  const visible = filterVisibleKolPool(records);
  return {
    records: visible,
    meta,
    counts: countKolBySection(visible),
    configured: isKolPoolConfigured(),
    total: visible.length,
  };
}

export async function patchKolPoolRecord(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const { id: notionPageId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const record = await updateKolPoolRecord(notionPageId, body);
    return restOk({ record });
  } catch (e) {
    if (e.status === 404) return restError('not_found', 404);
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}
