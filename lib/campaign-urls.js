/** Company-wide campaign workspace URL helpers. */

export const CAMPAIGNS_PATH = '/campaigns';

export function campaignListUrl() {
  return CAMPAIGNS_PATH;
}

export function campaignFlowUrl(campaignId, cview = 'flow', { people } = {}) {
  const params = new URLSearchParams({ flow: campaignId });
  if (cview && cview !== 'flow') params.set('cview', cview);
  appendPeopleSearchParam(params, people);
  return `${CAMPAIGNS_PATH}?${params.toString()}`;
}

export function campaignBoardUrl(boardId, cview = 'board', { people } = {}) {
  const params = new URLSearchParams({ board: boardId });
  if (cview && cview !== 'board') params.set('cview', cview);
  appendPeopleSearchParam(params, people);
  return `${CAMPAIGNS_PATH}?${params.toString()}`;
}

function appendPeopleSearchParam(params, people) {
  const peopleStr =
    people instanceof Set
      ? [...people].filter(Boolean).join(',')
      : String(people || '').trim();
  if (peopleStr) params.set('people', peopleStr);
}

export function campaignKolUrl(campaignId, kview = 'board') {
  const params = new URLSearchParams({ kol: campaignId });
  if (kview && kview !== 'board') params.set('kview', kview);
  return `${CAMPAIGNS_PATH}?${params.toString()}`;
}

/** Redirect legacy Marketing campaign URLs to /campaigns. */
export function legacyMarketingCampaignRedirect(sp) {
  if (!sp || typeof sp !== 'object') return null;
  const tool = sp.tool || '';
  const board = sp.board || '';
  const flow = sp.flow || '';
  const kol = sp.kol || '';
  if (tool !== 'campaigns' && !board && !flow && !kol) return null;
  const params = new URLSearchParams();
  if (flow) params.set('flow', flow);
  if (board) params.set('board', board);
  if (kol) params.set('kol', kol);
  if (sp.cview) params.set('cview', sp.cview);
  if (sp.kview) params.set('kview', sp.kview);
  const q = params.toString();
  return q ? `${CAMPAIGNS_PATH}?${q}` : CAMPAIGNS_PATH;
}
