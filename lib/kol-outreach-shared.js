/** Client-safe KOL outreach board helpers (no Node/fs imports). */

import { marketingKolOutreachUrl } from '@/lib/campaign-urls';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';

export { KOL_OUTREACH_BOARD_ID };

export const KOL_BOARD_PROP = {
  kolPoolId: 'prop_kol_pool_id',
  dealType: 'prop_deal_type',
  approachDate: 'prop_approach_date',
  socials: 'prop_socials',
  shippingDate: 'prop_shipping_date',
  trackingLink: 'prop_tracking_link',
  arrivalDate: 'prop_arrival_date',
  publishStatus: 'prop_publish_status',
};

export function isKolOutreachBoard(board) {
  return String(board?.id || '') === KOL_OUTREACH_BOARD_ID;
}

export function kolOutreachBoardUrl() {
  return marketingKolOutreachUrl();
}

export function defaultKolOutreachCustomProperties() {
  return [
    { id: KOL_BOARD_PROP.kolPoolId, type: 'text', label: 'KOL pool ID' },
    {
      id: KOL_BOARD_PROP.dealType,
      type: 'select',
      label: 'Deal type',
      options: ['Product barter', 'Paid', 'Hybrid', 'Other'],
    },
    { id: KOL_BOARD_PROP.approachDate, type: 'date', label: 'Approach date' },
    { id: KOL_BOARD_PROP.socials, type: 'text', label: 'Socials approached' },
    { id: KOL_BOARD_PROP.shippingDate, type: 'date', label: 'Shipping date' },
    { id: KOL_BOARD_PROP.trackingLink, type: 'link', label: 'Tracking link' },
    { id: KOL_BOARD_PROP.arrivalDate, type: 'date', label: 'Arrival date' },
    {
      id: KOL_BOARD_PROP.publishStatus,
      type: 'select',
      label: 'Publish status',
      options: ['Not published', 'Scheduled', 'Published'],
    },
  ];
}

const KOL_STATUS_COLUMN_LABELS = {
  not_started: 'Not started',
  waiting_response: 'Waiting for response',
  no_reply: 'No reply',
  no_deal: 'No deal',
  deal: 'Deal',
};

export function defaultKolOutreachStatusColumns() {
  return [
    'not_started',
    'waiting_response',
    'no_reply',
    'no_deal',
    'deal',
  ].map(id => ({ id, label: KOL_STATUS_COLUMN_LABELS[id] || id }));
}
