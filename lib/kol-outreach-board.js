import { randomUUID } from 'node:crypto';
import {
  deleteCampaignKolByCampaignId,
  listCampaignKolEntries,
} from '@/lib/campaign-kol-data';
import { getBoardById, writeBoardSeed } from '@/lib/internal-campaigns-data';
import { upsertHubTask } from '@/lib/internal-data';
import {
  defaultKolOutreachCustomProperties,
  defaultKolOutreachStatusColumns,
  KOL_BOARD_PROP,
  KOL_OUTREACH_BOARD_ID,
} from '@/lib/kol-outreach-shared';

export { KOL_OUTREACH_BOARD_ID } from '@/lib/kol-outreach-shared';

const DEAL_TYPE_LABELS = {
  product_barter: 'Product barter',
  paid: 'Paid',
  hybrid: 'Hybrid',
  other: 'Other',
};

const PUBLISH_STATUS_LABELS = {
  not_published: 'Not published',
  scheduled: 'Scheduled',
  published: 'Published',
};

export async function ensureKolOutreachBoard(actor = { displayName: 'System' }) {
  const existing = await getBoardById(KOL_OUTREACH_BOARD_ID);
  if (existing) return existing;

  const now = new Date().toISOString();
  const board = await writeBoardSeed({
    id: KOL_OUTREACH_BOARD_ID,
    campaign_id: null,
    department: 'marketing',
    owner_key: '',
    name: 'KOL outreach',
    description: '',
    kanban_only: true,
    status_columns: defaultKolOutreachStatusColumns(),
    custom_properties: defaultKolOutreachCustomProperties(),
    sort_order: -100,
    created_by: actor?.displayName || 'System',
    created_at: now,
    updated_at: now,
  });

  await migrateKolPipelineEntriesToBoard(board, actor);
  return board;
}

function entryToTask(entry, boardId, actorName) {
  const kol = entry.kol;
  const title = kol?.channel_name || entry.kol_notion_page_id || 'KOL';
  const socials = Array.isArray(entry.socials_approached)
    ? entry.socials_approached.join(', ')
    : '';

  return {
    id: entry.id || randomUUID(),
    kind: 'task',
    title,
    notes: entry.notes || '',
    department: 'marketing',
    subtype: 'kol',
    status: entry.pipeline_status || 'not_started',
    board_id: boardId,
    custom_values: {
      [KOL_BOARD_PROP.kolPoolId]: entry.kol_notion_page_id,
      ...(entry.deal_type ? { [KOL_BOARD_PROP.dealType]: DEAL_TYPE_LABELS[entry.deal_type] || entry.deal_type } : {}),
      ...(entry.approach_date ? { [KOL_BOARD_PROP.approachDate]: String(entry.approach_date).slice(0, 10) } : {}),
      ...(socials ? { [KOL_BOARD_PROP.socials]: socials } : {}),
      ...(entry.shipping_date ? { [KOL_BOARD_PROP.shippingDate]: String(entry.shipping_date).slice(0, 10) } : {}),
      ...(entry.tracking_link ? { [KOL_BOARD_PROP.trackingLink]: entry.tracking_link } : {}),
      ...(entry.arrival_date ? { [KOL_BOARD_PROP.arrivalDate]: String(entry.arrival_date).slice(0, 10) } : {}),
      ...(entry.publish_status
        ? { [KOL_BOARD_PROP.publishStatus]: PUBLISH_STATUS_LABELS[entry.publish_status] || entry.publish_status }
        : {}),
    },
    created_by: actorName || 'System',
    created_at: entry.created_at || new Date().toISOString(),
    updated_at: entry.updated_at || new Date().toISOString(),
  };
}

export async function migrateKolPipelineEntriesToBoard(board, actor = { displayName: 'System' }) {
  if (!board?.id) return { migrated: 0 };
  const entries = await listCampaignKolEntries(KOL_OUTREACH_BOARD_ID);
  if (!entries.length) return { migrated: 0 };

  let migrated = 0;
  for (const entry of entries) {
    await upsertHubTask(entryToTask(entry, board.id, actor.displayName), actor.displayName);
    migrated += 1;
  }

  if (migrated) {
    await deleteCampaignKolByCampaignId(KOL_OUTREACH_BOARD_ID);
  }
  return { migrated };
}
