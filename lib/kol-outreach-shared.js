/** Client-safe KOL outreach board helpers (no Node/fs imports). */

import { marketingKolOutreachUrl } from '@/lib/campaign-urls';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';

export { KOL_OUTREACH_BOARD_ID };

/** Reusable outreach initiatives (FBS, FBB, …). */
export const KOL_INITIATIVES = [
  { id: 'fbs', label: 'FBS' },
  { id: 'fbb', label: 'FBB' },
];

export const DEFAULT_KOL_INITIATIVE = 'fbs';

export function resolveKolInitiative(id) {
  const normalized = String(id || '').trim().toLowerCase();
  return KOL_INITIATIVES.some(item => item.id === normalized) ? normalized : DEFAULT_KOL_INITIATIVE;
}

export const KOL_APPROACH_PLATFORMS = [
  'Instagram',
  'YouTube',
  'TikTok',
  'X',
  'Facebook',
  'Email',
];

/** Who initiated first contact. */
export const KOL_APPROACH_DIRECTIONS = [
  { id: 'outbound', label: 'We reached out' },
  { id: 'inbound', label: 'They reached out first' },
];

export function normalizeApproachDirection(raw) {
  const id = String(raw || '').trim().toLowerCase();
  return id === 'inbound' ? 'inbound' : 'outbound';
}

export const KOL_DEAL_TYPES = [
  { id: 'Product barter', labelKey: 'hub.campaignKol.dealBarter' },
  { id: 'Paid', labelKey: 'hub.campaignKol.dealPaid' },
  { id: 'Hybrid', labelKey: 'hub.campaignKol.dealHybrid' },
  { id: 'Other', labelKey: 'hub.campaignKol.dealOther' },
];

/** Stored on no-deal cards when the preset "No reply" is chosen. */
export const KOL_NO_DEAL_REASON_NO_REPLY = 'No reply';

export const KOL_NO_DEAL_REASON_PRESET_NO_REPLY = 'no_reply';
export const KOL_NO_DEAL_REASON_PRESET_OTHER = 'other';

export function isNoReplyNoDealReason(reason) {
  const normalized = String(reason || '').trim().toLowerCase();
  return normalized === 'no reply' || normalized === 'kol not replying';
}

export function resolveNoDealReasonPreset(reason) {
  if (isNoReplyNoDealReason(reason)) return KOL_NO_DEAL_REASON_PRESET_NO_REPLY;
  if (String(reason || '').trim()) return KOL_NO_DEAL_REASON_PRESET_OTHER;
  return KOL_NO_DEAL_REASON_PRESET_NO_REPLY;
}

export const KOL_BOARD_PROP = {
  kolPoolId: 'prop_kol_pool_id',
  initiative: 'prop_initiative',
  dealType: 'prop_deal_type',
  dealTerms: 'prop_deal_terms',
  dealAmount: 'prop_deal_amount',
  dealDeadline: 'prop_deal_deadline',
  dealProducts: 'prop_deal_products',
  approachDate: 'prop_approach_date',
  approachDirection: 'prop_approach_direction',
  socials: 'prop_socials',
  followUpDate: 'prop_follow_up_date',
  followUpNote: 'prop_follow_up_note',
  noDealReason: 'prop_no_deal_reason',
  qcDate: 'prop_qc_date',
  qcCheckedBy: 'prop_qc_checked_by',
  qcNotes: 'prop_qc_notes',
  qcPassed: 'prop_qc_passed',
  weibinHandoffDate: 'prop_weibin_handoff_date',
  orderNumber: 'prop_order_number',
  shippingDate: 'prop_shipping_date',
  trackingLink: 'prop_tracking_link',
  trackingSent: 'prop_tracking_sent',
  trackingSentAt: 'prop_tracking_sent_at',
  mediaKitLink: 'prop_media_kit_link',
  mediaKitSent: 'prop_media_kit_sent',
  mediaKitSentAt: 'prop_media_kit_sent_at',
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
  'quality_control',
  'weibin',
  'shipping',
  'arrived',
  'publish',
  'no_deal',
];

const KOL_STATUS_COLUMN_LABELS = {
  not_started: 'Not started',
  waiting_response: 'Waiting for response',
  deal: 'Deal',
  no_deal: 'No deal',
  quality_control: 'Quality control',
  weibin: 'Weibin',
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
    { id: KOL_BOARD_PROP.dealAmount, type: 'text', label: 'Shipping & other fees' },
    { id: KOL_BOARD_PROP.dealDeadline, type: 'date', label: 'Deal deadline' },
    { id: KOL_BOARD_PROP.dealProducts, type: 'text', label: 'Products gifted' },
    { id: KOL_BOARD_PROP.approachDate, type: 'date', label: 'First contact date' },
    {
      id: KOL_BOARD_PROP.approachDirection,
      type: 'select',
      label: 'Who initiated',
      options: KOL_APPROACH_DIRECTIONS.map(item => item.label),
    },
    { id: KOL_BOARD_PROP.socials, type: 'text', label: 'Platforms' },
    { id: KOL_BOARD_PROP.followUpDate, type: 'date', label: 'Follow-up date' },
    { id: KOL_BOARD_PROP.followUpNote, type: 'text', label: 'Follow-up note' },
    { id: KOL_BOARD_PROP.noDealReason, type: 'text', label: 'No deal reason' },
    { id: KOL_BOARD_PROP.qcDate, type: 'date', label: 'QC date' },
    { id: KOL_BOARD_PROP.qcCheckedBy, type: 'text', label: 'QC checked by' },
    { id: KOL_BOARD_PROP.qcPassed, type: 'text', label: 'QC passed' },
    { id: KOL_BOARD_PROP.weibinHandoffDate, type: 'date', label: 'Weibin handoff date' },
    { id: KOL_BOARD_PROP.orderNumber, type: 'text', label: 'Order number' },
    { id: KOL_BOARD_PROP.shippingDate, type: 'date', label: 'Shipping date' },
    { id: KOL_BOARD_PROP.trackingLink, type: 'link', label: 'Tracking link (optional)' },
    { id: KOL_BOARD_PROP.trackingSent, type: 'text', label: 'Tracking link sent' },
    { id: KOL_BOARD_PROP.trackingSentAt, type: 'date', label: 'Tracking sent at' },
    { id: KOL_BOARD_PROP.mediaKitLink, type: 'link', label: 'Media kit link' },
    { id: KOL_BOARD_PROP.mediaKitSent, type: 'text', label: 'Media kit sent' },
    { id: KOL_BOARD_PROP.mediaKitSentAt, type: 'date', label: 'Media kit sent at' },
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

export function initiativeFromCampaign(campaign) {
  const hay = `${campaign?.id || ''} ${campaign?.name || ''} ${campaign?.title || ''}`.toLowerCase();
  if (/\bfbb\b/.test(hay)) return 'fbb';
  if (/\bfbs\b/.test(hay)) return 'fbs';
  return '';
}

export function kolOutreachBoardUrl(initiative = DEFAULT_KOL_INITIATIVE) {
  const base = marketingKolOutreachUrl();
  const id = resolveKolInitiative(initiative);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}initiative=${encodeURIComponent(id)}`;
}

export function outreachRowKey(poolId, initiative = '') {
  return `${String(poolId || '').trim()}:${String(initiative || 'general').trim().toLowerCase()}`;
}

export function initiativeLabel(id) {
  const match = KOL_INITIATIVES.find(item => item.id === id);
  return match?.label || String(id || '').toUpperCase() || '—';
}

const KOL_MAIN_PIPELINE = [
  'not_started',
  'waiting_response',
  'deal',
  'quality_control',
  'weibin',
  'shipping',
  'arrived',
  'publish',
];

/** Statuses that require a transition modal (in pipeline order). */
export const KOL_TRANSITION_MODAL_STATUSES = KOL_MAIN_PIPELINE.filter(id => id !== 'not_started');

/** Intermediate + final statuses when dragging forward across multiple columns. */
export function kolTransitionSteps(fromStatus, toStatus) {
  const from = normalizeKolOutreachStatus(fromStatus);
  const to = normalizeKolOutreachStatus(toStatus);
  if (!from || !to || from === to) return [];

  if (from === 'no_deal' || from === 'publish') return [];

  if (to === 'no_deal') {
    if (from === 'waiting_response') return ['no_deal'];
    if (from === 'not_started') return ['waiting_response', 'no_deal'];
    return [];
  }

  const fromIdx = KOL_MAIN_PIPELINE.indexOf(from);
  const toIdx = KOL_MAIN_PIPELINE.indexOf(to);
  if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) return [];

  return KOL_MAIN_PIPELINE.slice(fromIdx + 1, toIdx + 1);
}

/** Allowed forward transitions on the outreach pipeline (includes multi-column jumps). */
export function allowedKolTransition(fromStatus, toStatus) {
  return kolTransitionSteps(fromStatus, toStatus).length > 0;
}

export function kolOutreachStatusAtOrPast(status, milestone) {
  const order = [
    'not_started',
    'waiting_response',
    'deal',
    'quality_control',
    'weibin',
    'shipping',
    'arrived',
    'publish',
  ];
  const idx = order.indexOf(normalizeKolOutreachStatus(status));
  const milestoneIdx = order.indexOf(milestone);
  return idx >= 0 && milestoneIdx >= 0 && idx >= milestoneIdx;
}

/**
 * Cumulative card-modal sections — every pipeline stage reached stays visible and editable.
 * Card click = full outreach history, not just the current column.
 */
export function kolCardModalSections(status) {
  const id = normalizeKolOutreachStatus(status);

  if (id === 'no_deal') {
    return {
      approach: true,
      deal: false,
      noDeal: true,
      qualityControl: false,
      weibin: false,
      shipping: false,
      arrived: false,
      publish: false,
    };
  }

  if (id === 'not_started') {
    return {
      approach: false,
      deal: false,
      noDeal: false,
      qualityControl: false,
      weibin: false,
      shipping: false,
      arrived: false,
      publish: false,
    };
  }

  return {
    approach: kolOutreachStatusAtOrPast(id, 'waiting_response'),
    deal: kolOutreachStatusAtOrPast(id, 'deal'),
    noDeal: false,
    qualityControl: kolOutreachStatusAtOrPast(id, 'quality_control'),
    weibin: kolOutreachStatusAtOrPast(id, 'weibin'),
    shipping: kolOutreachStatusAtOrPast(id, 'shipping'),
    arrived: kolOutreachStatusAtOrPast(id, 'arrived'),
    publish: kolOutreachStatusAtOrPast(id, 'publish'),
  };
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

/** @deprecated legacy batch label — use order number */
export const LEGACY_WEIBIN_BATCH_PROP = 'prop_weibin_batch_code';

export function weibinExportFilename(orderNumbers = []) {
  const codes = [...new Set(orderNumbers.map(c => String(c || '').trim()).filter(Boolean))].sort();
  if (!codes.length) return 'KOL-shipment.xlsx';
  if (codes.length === 1) return `${codes[0]}.xlsx`;
  return `${codes[0]}-${codes[codes.length - 1]}.xlsx`;
}

export function kolOutreachOrderNumber(customValues = {}) {
  const cv = customValues || {};
  return String(cv[KOL_BOARD_PROP.orderNumber] || cv[LEGACY_WEIBIN_BATCH_PROP] || '').trim();
}

/** Canonical Weibin batch label prefix — stored as `KOL BP21`, `KOL BP22`, … */
export const KOL_ORDER_NUMBER_PREFIX = 'KOL BP';

/** Parse the numeric sequence from a KOL order label (`KOL BP21`, `kol bp 21`, …). */
export function parseKolOrderNumberSequence(raw = '') {
  const text = String(raw || '').trim();
  const match = text.match(/^kol\s+bp\s*#?\s*(\d+)\s*$/i);
  if (!match) return null;
  const sequence = Number.parseInt(match[1], 10);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
}

export function formatKolOrderNumber(sequence) {
  const n = Number.parseInt(sequence, 10);
  if (!Number.isFinite(n) || n < 1) return '';
  return `${KOL_ORDER_NUMBER_PREFIX}${n}`;
}

/** Normalize user input to canonical `KOL BP{n}` — preserves leading zeros (e.g. BP07). */
export function normalizeKolOrderNumber(raw = '') {
  const text = String(raw || '').trim();
  const match = text.match(/^kol\s+bp\s*#?\s*(\d+)\s*$/i);
  if (!match) return '';
  return `${KOL_ORDER_NUMBER_PREFIX}${match[1]}`;
}

/** Parse every KOL BP label in a field (single value or comma-separated list). */
export function parseKolOrderNumberLabels(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return [];
  const parts = text.split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);
  const source = parts.length ? parts : [text];
  const labels = [];
  for (const part of source) {
    const normalized = normalizeKolOrderNumber(part);
    if (normalized) labels.push(normalized);
  }
  return labels;
}

/** Normalize a single label or comma-separated order number field. */
export function normalizeKolOrderNumberField(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return '';
  const parts = text.split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return normalizeKolOrderNumber(text) || text;
  }
  return parts.map(part => normalizeKolOrderNumber(part) || part).join(', ');
}

export function latestKolOrderNumberSequence(tasks = []) {
  let max = 0;
  for (const task of Array.isArray(tasks) ? tasks : []) {
    for (const label of parseKolOrderNumberLabels(kolOutreachOrderNumber(task?.custom_values))) {
      const sequence = parseKolOrderNumberSequence(label);
      if (sequence != null && sequence > max) max = sequence;
    }
  }
  return max;
}

export function suggestNextKolOrderNumber(tasks = []) {
  return formatKolOrderNumber(latestKolOrderNumberSequence(tasks) + 1);
}

/** Map sequence → task using order numbers on outreach cards (optionally skip one task). */
export function kolOrderNumberUsageBySequence(tasks = [], { excludeTaskId = null } = {}) {
  const usage = new Map();
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (excludeTaskId && task?.id === excludeTaskId) continue;
    for (const label of parseKolOrderNumberLabels(kolOutreachOrderNumber(task?.custom_values))) {
      const sequence = parseKolOrderNumberSequence(label);
      if (sequence == null) continue;
      usage.set(sequence, {
        taskId: task.id,
        title: task.title || '',
        formatted: label,
      });
    }
  }
  return usage;
}

export function validateKolOrderNumber(raw, tasks = [], excludeTaskId = null) {
  const text = String(raw || '').trim();
  if (!text) return { ok: true, normalized: '' };

  const labels = parseKolOrderNumberLabels(text);
  if (!labels.length) {
    return { ok: true, normalized: text };
  }

  const seen = new Set();
  const usage = kolOrderNumberUsageBySequence(tasks, { excludeTaskId });
  for (const label of labels) {
    const sequence = parseKolOrderNumberSequence(label);
    if (sequence == null) continue;
    if (seen.has(sequence)) {
      return { ok: false, code: 'duplicate', normalized: label, sequence, conflict: { title: '—' } };
    }
    seen.add(sequence);
    const conflict = usage.get(sequence);
    if (conflict) {
      return { ok: false, code: 'duplicate', normalized: label, sequence, conflict };
    }
  }

  return { ok: true, normalized: normalizeKolOrderNumberField(text) };
}

export const KOL_WEIBIN_EXPORT_STATUSES = ['weibin', 'shipping', 'arrived'];

export function isKolWeibinExportStatus(status) {
  return KOL_WEIBIN_EXPORT_STATUSES.includes(normalizeKolOutreachStatus(status));
}

/** Build Weibin Excel download URL — one card, selected ids, or all (optional initiative filter). */
export function kolWeibinExportUrl({ taskIds = [], initiative = '' } = {}) {
  const params = new URLSearchParams();
  const ids = [...new Set((Array.isArray(taskIds) ? taskIds : []).map(id => String(id || '').trim()).filter(Boolean))];
  if (ids.length) {
    params.set('task_ids', ids.join(','));
  } else if (initiative) {
    params.set('initiative', String(initiative).trim().toLowerCase());
  }
  const qs = params.toString();
  return `/api/v1/marketing/kol-outreach/weibin-export${qs ? `?${qs}` : ''}`;
}

export function openKolWeibinExport(options = {}) {
  if (typeof window === 'undefined') return;
  window.open(kolWeibinExportUrl(options), '_blank', 'noopener,noreferrer');
}
