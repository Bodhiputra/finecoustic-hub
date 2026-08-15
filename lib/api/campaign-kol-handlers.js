import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import { getCampaignById } from '@/lib/internal-campaigns-data';
import {
  addCampaignKolFromPool,
  deleteCampaignKolEntry,
  listCampaignKolEntries,
  updateCampaignKolEntry,
} from '@/lib/campaign-kol-data';
import { createKolPoolRecord } from '@/lib/kol-pool-data';
import {
  restError,
  restForbidden,
  restNotFound,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function requireMarketingAccess(actor) {
  if (actor.mustChangePassword) return restForbidden('must_change_password');
  if (!canAccessDepartment(actor, 'marketing')) return restForbidden('department_forbidden');
  return null;
}

export async function getCampaignKol(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const { id: campaignId } = await params;
  const campaign = await getCampaignById(campaignId);
  if (!campaign) return restNotFound('campaign_not_found');

  const entries = await listCampaignKolEntries(campaignId);
  return restOk({ campaign, entries, count: entries.length });
}

export async function postCampaignKol(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const { id: campaignId } = await params;
  const campaign = await getCampaignById(campaignId);
  if (!campaign) return restNotFound('campaign_not_found');

  const body = await request.json().catch(() => ({}));
  let ids = Array.isArray(body.kol_ids) ? body.kol_ids : body.kol_notion_page_id ? [body.kol_notion_page_id] : [];

  try {
    if (body.new_kol && typeof body.new_kol === 'object') {
      const kol = await createKolPoolRecord(body.new_kol);
      ids = [kol.notion_page_id];
    }

    if (!ids.length) return restError('invalid_payload', 400);

    const created = await addCampaignKolFromPool(campaignId, ids);
    const entries = await listCampaignKolEntries(campaignId);
    return restOk({ created, entries, count: entries.length, kol_created: Boolean(body.new_kol) });
  } catch (e) {
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function patchCampaignKolEntry(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const { entryId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const entry = await updateCampaignKolEntry(entryId, body);
    return restOk({ entry });
  } catch (e) {
    if (e.status === 404) return restNotFound('entry_not_found');
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function deleteCampaignKol(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireMarketingAccess(actor);
  if (denied) return denied;

  const { entryId } = await params;
  const ok = await deleteCampaignKolEntry(entryId);
  if (!ok) return restNotFound('entry_not_found');
  return restOk({ deleted: true });
}
