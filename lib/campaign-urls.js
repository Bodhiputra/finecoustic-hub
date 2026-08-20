/** Company-wide campaign workspace URL helpers. */

import { getDepartmentPath, normalizeDepartmentId, PERSONAL_DEPARTMENT_ID } from '@/lib/internal';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';

export const CAMPAIGNS_PATH = '/campaigns';
export const CAMPAIGNS_HOME_QUERY = 'campaigns';

/** Campaign list on hub home (?campaigns=1), not bare /campaigns. */
export function campaignListHomeUrl() {
  return `/?${CAMPAIGNS_HOME_QUERY}=1`;
}

export function isCampaignHomeTab(searchParams) {
  if (!searchParams) return false;
  const get = key => (typeof searchParams.get === 'function' ? searchParams.get(key) : searchParams[key]);
  return get(CAMPAIGNS_HOME_QUERY) === '1';
}

export function isCampaignListHomeView(searchParams) {
  if (!isCampaignHomeTab(searchParams)) return false;
  const get = key => (typeof searchParams.get === 'function' ? searchParams.get(key) : searchParams[key]);
  return !get('flow') && !get('board');
}

export function homeCampaignFlowUrl(campaignId) {
  const params = new URLSearchParams({ [CAMPAIGNS_HOME_QUERY]: '1', flow: campaignId });
  return `/?${params.toString()}`;
}

export function isCampaignHomeWorkspace(searchParams) {
  if (!searchParams) return false;
  const get = key => (typeof searchParams.get === 'function' ? searchParams.get(key) : searchParams[key]);
  return get(CAMPAIGNS_HOME_QUERY) === '1';
}

export function campaignListUrl() {
  return campaignListHomeUrl();
}

export function campaignFlowUrl(campaignId, cview = 'flow', { people, subtype } = {}) {
  const params = new URLSearchParams({ flow: campaignId });
  if (cview && cview !== 'flow') params.set('cview', cview);
  appendPeopleSearchParam(params, people);
  appendSubtypeSearchParam(params, subtype);
  return `${CAMPAIGNS_PATH}?${params.toString()}`;
}

export function campaignBoardUrl(boardId, cview = 'board', { people, subtype } = {}) {
  const params = new URLSearchParams({ board: boardId });
  if (cview && cview !== 'board') params.set('cview', cview);
  appendPeopleSearchParam(params, people);
  appendSubtypeSearchParam(params, subtype);
  return `${CAMPAIGNS_PATH}?${params.toString()}`;
}

/** Department-native board URL — same board may also appear on a campaign flow. */
export function departmentBoardUrl(deptPath, boardId, cview = 'board', { people, subtype } = {}) {
  const base = String(deptPath || '').split('?')[0] || '/';
  const params = new URLSearchParams({ board: boardId });
  if (cview && cview !== 'board') params.set('cview', cview);
  appendPeopleSearchParam(params, people);
  appendSubtypeSearchParam(params, subtype);
  return `${base}?${params.toString()}`;
}

/** Personal workspace board URL — /me?board=… */
export function personalBoardUrl(boardId, cview = 'board', { subtype } = {}) {
  const params = new URLSearchParams({ board: boardId });
  if (cview && cview !== 'board') params.set('cview', cview);
  appendSubtypeSearchParam(params, subtype);
  return `/me?${params.toString()}`;
}

/** Open a board in its home department (or personal / KOL outreach workspace). */
export function boardOriginUrl(board, cview = 'board') {
  if (!board?.id) return campaignListHomeUrl();

  if (board.id === KOL_OUTREACH_BOARD_ID) {
    return marketingKolOutreachUrl();
  }

  const dept = normalizeDepartmentId(board.department);
  if (dept === PERSONAL_DEPARTMENT_ID || board.owner_key) {
    return personalBoardUrl(board.id, cview);
  }

  const deptPath = getDepartmentPath(dept || 'marketing');
  return departmentBoardUrl(deptPath, board.id, cview);
}

export function boardUrlForContext({ campaignsMode, deptPath, boardId, cview = 'board', people, subtype, personalMode } = {}) {
  if (personalMode) return personalBoardUrl(boardId, cview, { subtype });
  if (campaignsMode) return campaignBoardUrl(boardId, cview, { people, subtype });
  return departmentBoardUrl(deptPath, boardId, cview, { people, subtype });
}

function appendPeopleSearchParam(params, people) {
  const peopleStr =
    people instanceof Set
      ? [...people].filter(Boolean).join(',')
      : String(people || '').trim();
  if (peopleStr) params.set('people', peopleStr);
}

function appendSubtypeSearchParam(params, subtype) {
  const subtypeStr = String(subtype || '').trim();
  if (subtypeStr) params.set('subtype', subtypeStr);
}

/** @deprecated Use marketingKolOutreachUrl — KOL outreach lives under Marketing, not campaigns. */
export function campaignKolUrl(_campaignId) {
  return marketingKolOutreachUrl();
}

export function marketingKolOutreachUrl() {
  return '/marketing/kol-outreach';
}

/** Redirect legacy Marketing campaign URLs to /campaigns. Dept kanbans (?board= only) stay on /marketing. */
export function legacyMarketingCampaignRedirect(sp) {
  if (!sp || typeof sp !== 'object') return null;
  const tool = sp.tool || '';
  const board = sp.board || '';
  const flow = sp.flow || '';
  const kol = sp.kol || '';

  if (board === KOL_OUTREACH_BOARD_ID) return marketingKolOutreachUrl();

  // Legacy ?kol= or ?tool=kol-outreach → marketing KOL workspace
  if (kol || tool === 'kol-outreach') return marketingKolOutreachUrl();

  // Department-native kanban — open board in Marketing, not /campaigns
  if (board && !flow && tool !== 'campaigns') return null;

  if (tool !== 'campaigns' && !board && !flow) return null;
  const params = new URLSearchParams();
  if (flow) params.set('flow', flow);
  if (board) params.set('board', board);
  if (sp.cview) params.set('cview', sp.cview);
  if (sp.kview) params.set('kview', sp.kview);
  const q = params.toString();
  return q ? `${CAMPAIGNS_PATH}?${q}` : campaignListHomeUrl();
}
