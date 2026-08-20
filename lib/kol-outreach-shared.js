/** Client-safe KOL outreach board helpers (no Node/fs imports). */

import { marketingKolOutreachUrl } from '@/lib/campaign-urls';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';

export { KOL_OUTREACH_BOARD_ID };

/** Reusable outreach initiatives (FBS, FBB, …). */
export const KOL_INITIATIVES = [
  { id: 'fbs', label: 'FBS' },
  { id: 'fbb', label: 'FBB' },
];

export const KOL_APPROACH_PLATFORMS = [
  'Instagram',
  'YouTube',
  'TikTok',
  'X',
  'Facebook',
  'Email',
];

export const KOL_BOARD_PROP = {
  kolPoolId: 'prop_kol_pool_id',
  initiative: 'prop_initiative',
  dealType: 'prop_deal_type',
  dealTerms: 'prop_deal_terms',
  dealAmount: 'prop_deal_amount',
  dealDeadline: 'prop_deal_deadline',
  dealProducts: 'prop_deal_products',
  approachDate: 'prop_approach_date',
  socials: 'prop_socials',
  followUpDate: 'prop_follow_up_date',
  followUpNote: 'prop_follow_up_note',
  noDealReason: 'prop_no_deal_reason',
  qcDate: 'prop_qc_date',
  qcCheckedBy: 'prop_qc_checked_by',
  qcNotes: 'prop_qc_notes',
  shippingDate: 'prop_shipping_date',
  trackingLink: 'prop_tracking_link',
  mediaKitSent: 'prop_media_kit_sent',
  arrivalDate: 'prop_arrival_date',
  productArrived: 'prop_product_arrived',
  publishUrl: 'prop_publish_url',
  publishPlatform: 'prop_publish_platform',
  publishDate: 'prop_publish_date',
  /** @deprecated folded into no_deal */
  publishStatus: 'prop_publish_status',
};

export const KOL_STATUS_IDS = [
  'not_started',
  'waiting_response',
  'deal',
  'no_deal',
  'quality_control',
  'shipping',
  'arrived',
  'publish',
];

const KOL_STATUS_COLUMN_LABELS = {
  not_started: 'Not started',
  waiting_response: 'Waiting for response',
  deal: 'Deal',
  no_deal: 'No deal',
  quality_control: 'Quality control',
  shipping: 'Shipping',
  arrived: 'Arrived',
  publish: 'Publish',
};

/** Legacy status folded into no_deal. */
export function normalizeKolOutreachStatus(status) {
  const id = String(status || '').trim();
  if (id === 'no_reply') return 'no_deal';
  return id;
}

export function defaultKolOutreachStatusColumns() {
  return KOL_STATUS_IDS.map(id => ({ id, label: KOL_STATUS_COLUMN_LABELS[id] || id }));
}

export function defaultKolOutreachCustomProperties() {
  return [
    { id: KOL_BOARD_PROP.kolPoolId, type: 'text', label: 'KOL pool ID' },
    {
      id: KOL_BOARD_PROP.initiative,
      type: 'select',
      label: 'Initiative',
      options: KOL_INITIATIVES.map(item => item.label),
    },
    {
      id: KOL_BOARD_PROP.dealType,
      type: 'select',
      label: 'Deal type',
      options: ['Product barter', 'Paid', 'Hybrid', 'Other'],
    },
    { id: KOL_BOARD_PROP.dealTerms, type: 'text', label: 'Deal terms' },
    { id: KOL_BOARD_PROP.dealAmount, type: 'text', label: 'Amount / shipping fee' },
    { id: KOL_BOARD_PROP.dealDeadline, type: 'date', label: 'Deal deadline' },
    { id: KOL_BOARD_PROP.dealProducts, type: 'text', label: 'Products gifted' },
    { id: KOL_BOARD_PROP.approachDate, type: 'date', label: 'Approach date' },
    { id: KOL_BOARD_PROP.socials, type: 'text', label: 'Platforms approached' },
    { id: KOL_BOARD_PROP.followUpDate, type: 'date', label: 'Follow-up date' },
    { id: KOL_BOARD_PROP.followUpNote, type: 'text', label: 'Follow-up note' },
    { id: KOL_BOARD_PROP.noDealReason, type: 'text', label: 'No deal reason' },
    { id: KOL_BOARD_PROP.qcDate, type: 'date', label: 'QC date' },
    { id: KOL_BOARD_PROP.qcCheckedBy, type: 'text', label: 'QC checked by' },
    { id: KOL_BOARD_PROP.qcNotes, type: 'text', label: 'QC notes' },
    { id: KOL_BOARD_PROP.shippingDate, type: 'date', label: 'Shipping date' },
    { id: KOL_BOARD_PROP.trackingLink, type: 'link', label: 'Tracking link' },
    { id: KOL_BOARD_PROP.mediaKitSent, type: 'text', label: 'Media kit sent' },
    { id: KOL_BOARD_PROP.arrivalDate, type: 'date', label: 'Arrival date' },
    { id: KOL_BOARD_PROP.productArrived, type: 'text', label: 'Product arrived' },
    { id: KOL_BOARD_PROP.publishUrl, type: 'link', label: 'Publish URL' },
    { id: KOL_BOARD_PROP.publishPlatform, type: 'text', label: 'Publish platform' },
    { id: KOL_BOARD_PROP.publishDate, type: 'date', label: 'Publish date' },
  ];
}

export function isKolOutreachBoard(board) {
  return String(board?.id || '') === KOL_OUTREACH_BOARD_ID;
}

export function kolOutreachBoardUrl(initiative = '') {
  const base = marketingKolOutreachUrl();
  if (!initiative) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}initiative=${encodeURIComponent(initiative)}`;
}

export function outreachRowKey(poolId, initiative = '') {
  return `${String(poolId || '').trim()}:${String(initiative || 'general').trim().toLowerCase()}`;
}

export function initiativeLabel(id) {
  const match = KOL_INITIATIVES.find(item => item.id === id);
  return match?.label || String(id || '').toUpperCase() || '—';
}

/** Allowed forward transitions on the outreach pipeline. */
export function allowedKolTransition(fromStatus, toStatus) {
  const from = normalizeKolOutreachStatus(fromStatus);
  const to = normalizeKolOutreachStatus(toStatus);
  if (!from || !to || from === to) return false;
  const map = {
    not_started: ['waiting_response'],
    waiting_response: ['deal', 'no_deal'],
    deal: ['quality_control'],
    quality_control: ['shipping'],
    shipping: ['arrived'],
    arrived: ['publish'],
    no_deal: [],
    publish: [],
  };
  return (map[from] || []).includes(to);
}

export function parseDealProducts(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map(row => ({
        product: String(row?.product || row || '').trim(),
        qty: Math.max(1, Number(row?.qty) || 1),
      }))
      .filter(row => row.product);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parseDealProducts(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

export function serializeDealProducts(rows) {
  return JSON.stringify(
    (rows || [])
      .map(row => ({
        product: String(row?.product || '').trim(),
        qty: Math.max(1, Number(row?.qty) || 1),
      }))
      .filter(row => row.product)
  );
}
