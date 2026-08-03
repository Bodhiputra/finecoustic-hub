/** Marketing campaign workspace URL helpers. */

export function campaignListUrl() {
  return '/marketing?tool=campaigns';
}

export function campaignFlowUrl(campaignId, cview = 'flow') {
  const params = new URLSearchParams({ tool: 'campaigns', flow: campaignId });
  if (cview && cview !== 'flow') params.set('cview', cview);
  return `/marketing?${params.toString()}`;
}

export function campaignBoardUrl(boardId, cview = 'board') {
  const params = new URLSearchParams({ tool: 'campaigns', board: boardId });
  if (cview && cview !== 'board') params.set('cview', cview);
  return `/marketing?${params.toString()}`;
}
