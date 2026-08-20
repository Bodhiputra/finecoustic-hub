/** Marketing KOL outreach pipeline — statuses, deal types, board columns. */

/** Fixed id for the marketing KOL outreach kanban board. */
export const KOL_OUTREACH_BOARD_ID = 'marketing-kol-outreach';

/** @deprecated Use KOL_OUTREACH_BOARD_ID */
export const MARKETING_KOL_OUTREACH_SCOPE = KOL_OUTREACH_BOARD_ID;

export function isMarketingKolOutreachScope(id) {
  return String(id || '') === KOL_OUTREACH_BOARD_ID;
}

export const KOL_PIPELINE_STATUSES = [
  { id: 'not_started', labelKey: 'hub.campaignKol.statusNotStarted' },
  { id: 'waiting_response', labelKey: 'hub.campaignKol.statusWaitingResponse' },
  { id: 'no_reply', labelKey: 'hub.campaignKol.statusNoReply' },
  { id: 'no_deal', labelKey: 'hub.campaignKol.statusNoDeal' },
  { id: 'deal', labelKey: 'hub.campaignKol.statusDeal' },
];

export const KOL_PIPELINE_STATUS_IDS = KOL_PIPELINE_STATUSES.map(s => s.id);

export const KOL_DEAL_TYPES = [
  { id: 'product_barter', labelKey: 'hub.campaignKol.dealBarter' },
  { id: 'paid', labelKey: 'hub.campaignKol.dealPaid' },
  { id: 'hybrid', labelKey: 'hub.campaignKol.dealHybrid' },
  { id: 'other', labelKey: 'hub.campaignKol.dealOther' },
];

export const KOL_PUBLISH_STATUSES = [
  { id: 'not_published', labelKey: 'hub.campaignKol.publishNot' },
  { id: 'scheduled', labelKey: 'hub.campaignKol.publishScheduled' },
  { id: 'published', labelKey: 'hub.campaignKol.publishDone' },
];

export function normalizeSocialsApproached(raw) {
  if (Array.isArray(raw)) return raw.map(s => String(s || '').trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,;|\n]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeCampaignKolEntry(raw = {}) {
  const status = KOL_PIPELINE_STATUS_IDS.includes(raw.pipeline_status)
    ? raw.pipeline_status
    : 'not_started';
  const dealType = KOL_DEAL_TYPES.some(d => d.id === raw.deal_type) ? raw.deal_type : '';
  const publishStatus = KOL_PUBLISH_STATUSES.some(p => p.id === raw.publish_status)
    ? raw.publish_status
    : 'not_published';

  return {
    id: String(raw.id || ''),
    campaign_id: String(raw.campaign_id || ''),
    kol_notion_page_id: String(raw.kol_notion_page_id || ''),
    pipeline_status: status,
    deal_type: dealType,
    approach_date: raw.approach_date || null,
    socials_approached: normalizeSocialsApproached(raw.socials_approached),
    shipping_date: raw.shipping_date || null,
    tracking_link: String(raw.tracking_link || '').trim(),
    arrival_date: raw.arrival_date || null,
    publish_status: publishStatus,
    notes: String(raw.notes || '').trim(),
    sort_order: Number.isFinite(raw.sort_order) ? raw.sort_order : 0,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    kol: raw.kol && typeof raw.kol === 'object' ? raw.kol : null,
  };
}

export function campaignKolBoardColumns(t) {
  return KOL_PIPELINE_STATUSES.map(col => ({
    id: col.id,
    label: t(col.labelKey),
  }));
}

export function groupCampaignKolByStatus(entries) {
  const map = Object.fromEntries(KOL_PIPELINE_STATUS_IDS.map(id => [id, []]));
  for (const entry of entries) {
    const key = KOL_PIPELINE_STATUS_IDS.includes(entry.pipeline_status)
      ? entry.pipeline_status
      : 'not_started';
    map[key].push(entry);
  }
  for (const id of KOL_PIPELINE_STATUS_IDS) {
    map[id].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  }
  return map;
}
